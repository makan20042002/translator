using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Globalization;
using Windows.Media.Ocr;

namespace MakanOcr;

class Program
{
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiFlag);

    private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

    static async Task<int> Main(string[] args)
    {
        try
        {
            try
            {
                SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            }
            catch {}

            if (args.Length > 0 && (args[0] == "--list-languages" || args[0] == "-l"))
            {
                var langs = OcrEngine.AvailableRecognizerLanguages.Select(l => new {
                    tag = l.LanguageTag,
                    displayName = l.DisplayName,
                    nativeName = l.NativeName
                }).ToList();
                Console.WriteLine(JsonSerializer.Serialize(new { ok = true, languages = langs }));
                return 0;
            }

            if (args.Length == 0)
            {
                Console.WriteLine(JsonSerializer.Serialize(new {
                    ok = false,
                    error = "Usage:\n  MakanOcr --stdin [--lang <tag>]\n  MakanOcr --capture <x> <y> <w> <h> [--lang <tag>]\n  MakanOcr <image-path> [--lang <tag>]\n  MakanOcr --list-languages"
                }));
                return 1;
            }

            string? langTag = null;
            for (int i = 0; i < args.Length; i++)
            {
                if ((args[i] == "--lang" || args[i] == "-lang") && i + 1 < args.Length)
                {
                    langTag = args[i + 1];
                }
            }

            Bitmap? bmp = null;
            if (args[0] == "--stdin")
            {
                using var stdinStream = Console.OpenStandardInput();
                using var msInput = new MemoryStream();
                await stdinStream.CopyToAsync(msInput);
                msInput.Position = 0;
                bmp = new Bitmap(msInput);
            }
            else if (args[0] == "--capture" || args[0] == "-c")
            {
                if (args.Length < 5)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = "Invalid capture coordinates. Expected: --capture <x> <y> <w> <h>" }));
                    return 1;
                }

                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);
                int w = int.Parse(args[3]);
                int h = int.Parse(args[4]);

                if (w <= 0 || h <= 0)
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = "Region width and height must be positive." }));
                    return 1;
                }

                bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(x, y, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
                }
            }
            else
            {
                string imagePath = args[0];
                if (!File.Exists(imagePath))
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = $"File not found: {imagePath}" }));
                    return 1;
                }
                bmp = new Bitmap(imagePath);
            }

            using (bmp)
            {
                var ocrOutput = await RunOcrAsync(bmp, langTag);
                Console.WriteLine(JsonSerializer.Serialize(ocrOutput));
                return ocrOutput.ok ? 0 : 1;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = ex.Message }));
            return 1;
        }
    }

    private static async Task<OcrResultDto> RunOcrAsync(Bitmap bmp, string? langTag)
    {
        OcrEngine? engine = null;
        if (!string.IsNullOrWhiteSpace(langTag) && langTag != "auto")
        {
            var targetLang = new Language(langTag);
            if (OcrEngine.IsLanguageSupported(targetLang))
            {
                engine = OcrEngine.TryCreateFromLanguage(targetLang);
            }
            else
            {
                var available = OcrEngine.AvailableRecognizerLanguages.Select(l => l.LanguageTag).ToList();
                return new OcrResultDto {
                    ok = false,
                    error = $"Windows OCR language '{langTag}' is not installed.",
                    languageNotInstalled = true,
                    requestedLanguage = langTag,
                    availableLanguages = available,
                    installationGuidance = "To add language OCR support: Open Windows Settings > Time & Language > Language & region > Add a language (ensure Optical Character Recognition is checked)."
                };
            }
        }

        engine ??= OcrEngine.TryCreateFromUserProfileLanguages();
        if (engine == null)
        {
            var first = OcrEngine.AvailableRecognizerLanguages.FirstOrDefault();
            if (first != null) engine = OcrEngine.TryCreateFromLanguage(first);
        }

        if (engine == null)
        {
            return new OcrResultDto {
                ok = false,
                error = "No OCR engine available on this system."
            };
        }

        using var ms = new MemoryStream();
        bmp.Save(ms, ImageFormat.Bmp);
        ms.Position = 0;

        var decoder = await BitmapDecoder.CreateAsync(ms.AsRandomAccessStream());
        var softwareBitmap = await decoder.GetSoftwareBitmapAsync();

        var ocrResult = await engine.RecognizeAsync(softwareBitmap);

        var lines = ocrResult.Lines.Select(line => new OcrLineDto {
            text = line.Text,
            words = line.Words.Select(w => new OcrWordDto {
                text = w.Text,
                x = (int)w.BoundingRect.X,
                y = (int)w.BoundingRect.Y,
                width = (int)w.BoundingRect.Width,
                height = (int)w.BoundingRect.Height
            }).ToList()
        }).ToList();

        return new OcrResultDto {
            ok = true,
            text = ocrResult.Text,
            angle = ocrResult.TextAngle,
            language = engine.RecognizerLanguage.LanguageTag,
            lines = lines
        };
    }
}

public class OcrResultDto
{
    public bool ok { get; set; }
    public string? text { get; set; }
    public double? angle { get; set; }
    public string? language { get; set; }
    public System.Collections.Generic.List<OcrLineDto>? lines { get; set; }
    public string? error { get; set; }
    public bool languageNotInstalled { get; set; }
    public string? requestedLanguage { get; set; }
    public System.Collections.Generic.List<string>? availableLanguages { get; set; }
    public string? installationGuidance { get; set; }
}

public class OcrLineDto
{
    public string text { get; set; } = "";
    public System.Collections.Generic.List<OcrWordDto> words { get; set; } = new();
}

public class OcrWordDto
{
    public string text { get; set; } = "";
    public int x { get; set; }
    public int y { get; set; }
    public int width { get; set; }
    public int height { get; set; }
}
