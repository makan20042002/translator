/* ---------- i18n ---------- */
const I18N={en:{
 pageTranslateTitle:'Translate',pageTranslateSub:'Translate text with AI engines, online or offline.',pageSubTitle:'Subtitles',pageSubSub:'Translate .srt and .vtt files, or make subtitles from a video',pageDocTitle:'Documents',pageDocSub:'Translate Word, PowerPoint, Excel, text, Markdown, CSV and JSON files.',pageVoiceTitle:'Voice',pageVoiceSub:'Talk and hear the translation.',pageVoiceSubOffline:'Talk and hear the translation, offline.',vSttPrefix:'Speech recognition:',vVoicePrefix:'Voice:',voiceReady:'Ready',voiceNotReady:'Not ready',voiceNoMic:'Microphone blocked',voiceNoSR:'Speech recognition unavailable',voiceNoModel:'Model not downloaded',voiceNoHelper:'Speech helper not connected',voiceNoKey:'API key required',voiceNoTrans:'Translation engine not ready',voiceNoVoice:'No voice for target language',holdHint:'hold',noMicrophone:'No microphone detected',liveConversation:'Live conversation',docDropTitle:'Drop a document here',docDropBrowse:'or click to browse',docSummaryTitle:'Translation Summary',subVideoTitle:'Make subtitles from a video or audio file',subVideoComingSoon:'Coming soon',subVideoHelperNote:'Requires the local speech helper desktop app',transMemory:'Translation memory',translatedChip:'Translated',cardSwap:'Swap',noVoiceInstalled:'No voice installed',recentTranslations:'Recent translations',viewAll:'View all',noRecentTranslations:'No recent translations yet.',statusOfflineAvail:'Offline engines available',statusOnlineActive:'Internet engines active',statusNotDownloaded:'not downloaded',statusReady:'ready',statusOllamaReady:'Ollama ready',statusOllamaDown:'Ollama unreachable',
 engines:'Engines & keys',eyebrow:'Text · Subtitles · Documents · Voice',h1a:'One translator,',h1b:'every engine.',
 tabEnginesKeys:'Translation engines & keys',tabVoices:'Voices (reading aloud)',tabVoiceModels:'Voice models (speech recognition)',tabTrModels:'Translation models (offline)',tabOcr:'Screen reading (OCR)',
 tabIdiom:'Idioms',idPh:'Type an idiom or saying…',idFindH:'Find an idiom by its meaning',idFindHint:'Describe what you want to say, for example “someone who talks too much”. Needs an AI engine.',idDescPh:'Describe a meaning…',idFindBtn:'Find idioms',idStored:'Stored idiom',idAiH:'AI explanation',idMeaning:'Meaning',idLiteral:'Literal wording',idEquivalent:'Natural equivalent',idRegister:'Register',idExamples:'Examples',idNotIdiom:'The AI does not think this is an idiom.',idNoAiStored:'No AI engine is available, so only the stored entry is shown.',idNoAiNone:'This is not in the stored idioms, and no AI engine is available to explain it. Add a key in Engines & keys.',idFindNoAi:'Finding idioms by meaning is done by an AI engine, and none is available. Add a key in Engines & keys.',idSave:'Save idiom',idIdiomBadge:'idiom',idAsking:'Asking the AI…',idNoMatch:'No matching idioms found.',idMarkTitle:'Idiom: click for its meaning',tabDict:'Dictionary',dictPh:'Type a word…',dictSearch:'Search',dictVulgar:'Show vulgar words',dictAuto:'Auto (detect language)',dictHidden:'This word is marked as vulgar and hidden. Turn on “Show vulgar words” to see it.',dictHiddenSome:'Some entries are hidden (vulgar). Turn on “Show vulgar words” to see them.',dictGetPack:'Get the dictionary',dictNoPack:'The offline dictionary for this language is not downloaded yet.',dictNotFound:'No entry found for this word.',dictMyWords:'My words',dictExport:'Export CSV',dictClear:'Clear list',dictLocalOnly:'The word list is stored only in this browser.',dictSave:'Save word',dictSaved:'Saved ✓',dictExplain:'Explain with AI',dictExplaining:'Asking the AI…',dictNoAi:'No AI engine is available. Add a key in Engines & keys.',dictPhrases:'Idioms and phrases',dictForms:'Forms',dictAlso:'More meanings (from the other dictionary)',dictFormOf:'form of',dictPackEnFa:'Dictionary · English → Persian · about 1.1 MB',dictPackFaEn:'Dictionary · Persian → English · about 0.9 MB',dictRemove:'Remove',dictPackNote:'The dictionary works without internet once downloaded, also with Offline mode on. Data from Wiktionary (CC BY-SA); see About & credits.',creditsBtn:'About & credits',creditsText:'Offline dictionary: data from Wiktionary (CC BY-SA 4.0 / GFDL), extracted with Wiktextract and distributed by Kaikki.org; entries chosen with the wordfreq ranking by Robyn Speer (CC BY-SA 4.0). The dictionary is shared under the same CC BY-SA licence. Attribution does not imply endorsement. Offline voices: Piper voices from rhasspy/piper-voices (MIT) run with ONNX Runtime Web (MIT) and the eSpeak NG phonemizer (GPL-3.0-or-later; its files are in vendor/piper). The voices Amir, Ganji, LJ Speech, Cori and Kristin are CC0 / public domain; the voice Alba (University of Edinburgh) is CC BY 4.0. Offline translation and speech models come from Hugging Face; each model keeps its own licence (the NLLB-200 models are CC BY-NC 4.0).',dictDownloading:'Downloading…',dictAiAsk:'Explain the word or phrase below for a learner: its usage, its register (formal, neutral, informal or slang) and three short example sentences, each with a translation. Be concise.',tabText:'Text',tabSub:'Subtitle',tabDoc:'Document',tabVoice:'Voice',tabCmp:'Compare',tabGls:'Glossary',tabHist:'History',
  engine:'Engine',mode:'Mode',modeBoth:'Both (Fast → Smart)',modeFast:'Fast',modeSmart:'Smart',fastLabel:'Fast',fromMemory:'from memory',showImproved:'Show improved',aiUnavailable:'AI unavailable',waitingFor:'Waiting for',fastFailed:'Fast engines failed, showing Smart result',aiRateLimited:'AI rate-limited',tone:'Tone',toneN:'Neutral',toneF:'Formal',toneC:'Casual',toneT:'Technical',
 from:'From',to:'To',detectedPrefix:'Detected:',swapHint:'Please select or detect a language first',
 source:'Source',translation:'Translation',original:'Original',mic:'Mic',paste:'Paste',clear:'Clear',stop:'Stop',translate:'Translate',speak:'Speak',copy:'Copy',
 phIn:'Type or paste text…',phCmp:'Text to compare across engines…',
 sDrop:'Drop a subtitle file here',sDrop2:'or click to choose. Timings are kept exactly.',bilingual:'Bilingual export',sRest:'Translate empty lines',sAll:'Translate all',
 dDrop:'Drop a TXT, Markdown, JSON or CSV file',dDrop2:'Structure stays intact: JSON keys, CSV columns and Markdown markers are not touched.',dGo:'Translate file',download:'Download',
 vHint:'Two people, two languages. Press a button, speak, and the translation is shown and read aloud.',vAuto:'Read translation aloud',noSR:'Speech recognition is not available in this browser. Use Chrome or Edge.',
 compare:'Compare',gHint:'Terms that must always be translated your way: names, brands, technical words. Applied in every mode.',gAdd:'+ Add term',
 hHint:'Saved only in this browser.',hClear:'Clear history',foot:'Keys stay in your browser and are sent only to the provider you choose.',
 setNote:'Free engines work with no setup. For better quality add a free key (Gemini, Groq or OpenRouter). In Auto mode engines are tried from top to bottom, and the next one takes over if one fails.',
 mmEmail:'MyMemory e-mail (optional, raises the daily limit)',
 auto:'Auto (best available)',detect:'Detect language',copied:'Copied',noEngine:'No engine is available. Open “Engines & keys”.',
 failed:'failed',switching:'switching to',done:'Done',stopped:'Stopped. Finished lines are kept.',rateLimited:'rate limit reached. Wait a minute and try again.',lines:'lines',cues:'cues',segments:'segments',via:'via',chars:'characters',
 speakIn:'Speak',empty:'Nothing here yet.',test:'Test',works:'works',getKey:'Get key',free:'free',freekey:'free key',paid:'paid',custom:'custom',
 key:'API key',model:'Model',baseUrl:'Base URL (OpenAI-compatible)',needKey:'needs a key',notHere:'not supported in this browser',term:'Term',termTo:'Always translate as',
 tipKey:'Large job on a free engine. A free Gemini or Groq key will be faster and more accurate.',pick2:'Pick at least one engine.',sameLang:'Choose a source language for this.',offMode:'Offline mode',voiceH:'Voice',sttL:'Speech to text (microphone)',sttAuto:'Auto (best available)',sttBrowser:'Browser (online)',sttGroq:'Groq Whisper (online, uses Groq key)',sttWh:'Whisper in browser (offline)',
 ttsL:'Text to speech (read aloud)',ttsDev:'Device / browser voices',ttsApiO:'Speech server (Sesame CSM, OpenAI…)',preset:'Preset',voiceName:'Voice name',ttsTest:'Test voice',voiceFor:'Voice for',autoVoice:'Auto (best)',
 ttsHint:'Any server with an OpenAI-style /audio/speech endpoint works. Sesame CSM must run on a PC with an NVIDIA GPU; start its server, then press Test voice. If the server is unreachable, the device voice is used.',
 edgeHint:'Tip: Microsoft Edge includes free natural voices for Persian and many other languages. In Chrome the list depends on the voices installed in Windows.',
 tmH:'Translation memory',tmNote:'Local translation cache in this browser. When enabled, past translations are reused instantly without calling engines.',tmSavedCount:'Saved translations:',tmClear:'Clear memory',tmClearSure:'Click again to clear',tmCleared:'Translation memory cleared',fromCorrection:'Your correction',saveCorrection:'Save my correction',correctionSaved:'Correction saved to memory',
 offH:'Offline',offNote:'Download once while online, then translate with no internet. Models stay in this browser. Offline mode uses only: the models you download here, Chrome on-device, Ollama and local servers.',
 offTr:'Translation model · NLLB, 200 languages · about 900 MB',offAsr:'Speech model · Whisper (~80 MB WASM / ~155 MB WebGPU)',ready:'ready',notDl:'not downloaded',dlDone:'Download finished. Ready for offline use.',
 needDl:'download it first (Engines & keys → Offline)',needUrl:'needs a URL',needModel:'choose a model',install:'Install',local:'local',offline:'offline',
 ollamaHint:'Install Ollama, run “ollama pull gemma3”, then press Models. If Ollama is not already reachable, set OLLAMA_ORIGINS={origin} in Windows environment variables and restart Ollama after.',
 customHint:'LM Studio: http://localhost:1234/v1 · any OpenAI-compatible server works.',
 noOff:'No offline engine is ready. Open “Engines & keys” → Offline and download the model, or set up Ollama.',offHelp:'Offline mode: download the translation model in Engines & keys, or start Ollama.',micBlocked:'Microphone is blocked',voiceUsed:'Voice',voiceDevice:'Device',geminiWord:'Gemini',geminiVoicesGrp:'Gemini voices',deviceVoicesGrp:'This device',edgeHint:'Microsoft Edge has built-in natural voices for this language.',noVoiceNoKey:'No voice for this language on this device, and no Gemini key is set. Add a Gemini key in Engines & keys, or try Microsoft Edge.',noVoice:'No voice for this language on this device. Try Microsoft Edge or install the language voice in Windows.',ttsFallback:'using device voice',
 loadModels:'Models',
 vModeConv:'Conversation',vModeAsk:'Ask AI',
 vLive:'Live',vLiveHint:'Hands-free: listens and speaks continuously',vLiveListening:'Listening…',vLiveListenBrowser:'Listening (Alternating turns — tap speaker to switch)…',vLiveListenDetect:'Listening (Auto-detecting language)…',vLiveTranslating:'Translating…',vLiveSpeaking:'Speaking…',vStopLive:'Stop Live',
 vBrowserNoDetect:'Browser speech recognition cannot detect language before listening. Choose who is speaking:',
 vFileProtoNotice:'Browsers cannot save microphone permission for local files (file://). Permission will be remembered when running on localhost or a website.',
 stopSpeak:'Stop speaking',replay:'Replay',speed:'Speed',
 vAskHint:'Ask a question by voice or typing. AI answers and speaks back.',vAskPh:'Ask a question or request…',vAskSend:'Ask',vAskNew:'New chat',vAskLang:'Answer language',vAskThinking:'Thinking…',
 noAiEngine:'No AI engine is ready. Open “Engines & keys”.',
 checkConn:'Check connections',connChecking:'Checking…',connWorks:'works',connNeedsKey:'needs a key',connKeyRejected:'key rejected',connNetBlocked:'not reachable from your network',connCors:'blocked by the browser (CORS)',connLocalDown:'not running on this PC — start it and check again',
 exportForExt:'Export for Extension',settingsExported:'Settings exported for Extension!',
 ttsGemini:'Google Gemini TTS',ttsOpenAI:'OpenAI TTS',sttGemini:'Gemini (online, uses Gemini key)',regionBlocked:'This provider is not reachable from your network.',groqKeyWarn:'⚠️ Groq API keys usually start with “gsk_”. Please check that you copied a valid key from console.groq.com.',
 pttTalk:'Push to Talk',pttHold:'Hold to speak · Release to send · Space key or tap',
 pttListeningHold:'Listening… (Release to send)',pttListeningTap:'Listening… (Tap again or Space to send)',
 micActive:'Mic open',micRecording:'Recording',
 subStyle:'Style',subStyleFilm:'Film / spoken',subStyleNeutral:'Neutral',subStyleFormal:'Formal',
 subFamily:'Family-friendly (soften swearing)',
 subNonAiWarn:'⚠️ Non-AI engines (Google, MyMemory, Offline) cannot follow styles or spoken Persian. Choose an AI engine (Gemini, Groq, OpenRouter) for film subtitles.',
 subChangeFile:'Change file',outFormat:'Output format',outSame:'Same as input',outWord:'Word (.docx)',outPdf:'PDF (.pdf)',outMd:'Markdown (.md)',outTxt:'Plain text (.txt)',outTooLong:'This document is too long for PDF output. Choose Word or another format.',subCloseFile:'Close file',subCloseSure:'Click again to discard the translation',subColNum:'#',subColTime:'Time',subColOrig:'Original',subColTrans:'Translation',
 silenceWaitL:'Silence wait (end of speech)',liveVoice:'Live voice',vAudioInputLabel:'Audio Input',vAudioInputL:'Audio Input (Mic vs Video/PC Audio)',fastVoice:'Fast (Device / Edge)',qualityVoice:'Quality (Gemini voice)',
 saveConv:'Save conversation',convSaved:'Conversation saved to file',convCleared:'Conversation cleared',settings:'Settings',
 readAloud:'Read aloud',enabled:'Enabled',vStatusReady:'Ready · Hold to speak',vStatusListening:'Listening…',
 vStatusWorking:'Translating…',vStatusSpeaking:'Speaking translation…',vStatusPreparing:'Preparing voice…',vPreparingPtt:'Preparing…',vPreparingTapStop:'Tap to cancel',vStatusError:'Error',
 vEmptyTitle:'Bilingual Voice Conversation',vEmptyDesc:'Hold the Talk button to speak. Your words are translated and read aloud automatically.',
 vTipNoKey:'Using free browser speech & translation. Add a free Gemini or Groq key in Engines & keys for human-like voices and faster speech recognition.',
 vTipHasKey:'AI engine active for natural voice and fast speech recognition.',
 vAskNoAiTitle:'AI Assistant Setup',vAskNoAiDesc:'Ask AI requires an AI key (Gemini, Groq, OpenRouter) or local model (Ollama). Free keys work with no payment.',
 vAskEmptyTitle:'Ask AI Assistant',vAskEmptyDesc:'Ask questions by voice or typing in any language. The AI answers and reads the response aloud.',
 vAskStatusReady:'Ready · Ask a question',micLowWarn:'Microphone volume is very low. Please speak closer to the mic.',
 retranslate:'Re-translate',tapToEdit:'Click to edit and re-translate',speakerA:'Speaker A',speakerB:'Speaker B',
 pttReleaseSend:'Release to send',pttTapStop:'Tap to send',working:'Translating…',workingWait:'Translating audio · Please wait',
 vSpeakingPtt:'Speaking…',vSpeakingTapStop:'Tap Talk to interrupt and speak',retry:'Retry',tapToRetry:'Tap to try speaking again',
 timeoutListening:'Listening timed out',timeoutWorking:'Translation timed out',noVoiceWarn:'No speech voice installed for this language. Use Microsoft Edge or install voices in Windows Settings.',talk:'Talk',
 docOffice:'Document & Office',pdfNotSupported:'PDF translation is not supported yet. Please convert to Word (.docx) or use TXT/Markdown.',
 docSubject:'Subject & Domain',docSubjectAuto:'Auto (detect from document)',docRegister:'Register',docRegNeutral:'Neutral / Standard',docRegTechnical:'Technical / Specialized',docRegFormal:'Formal / Academic',docRegCasual:'Casual / Colloquial',
 docKeyTerms:'Key Terminology',docAddTerm:'+ Add term',docAddToGlossary:'+ Add to Glossary',docTermsSaved:'Terms added to Glossary',docAnalyzing:'Analyzing document subject & key terms…',
 docReviewTerms:'Review in context',docReviewing:'Reviewing detected terms in context…',docReviewDone:'Terminology reviewed: {n} corrected/verified.',
 docKeepLayout:'Keep page layout',
 docNotes:'Translator notes',docNotesDesc:'Attach footnotes or slide notes for ambiguous terms & context',docEstSize:'Estimated size',
 docSegments:'segments',docWords:'words',docPagesEst:'pages',docSlidesEst:'slides',docRowsEst:'rows',
 docEngineNoticeText:'Subject analysis & translator notes require an AI engine. With non-AI engines, standard translation and Glossary are used.',
 docFormattingNote:'Formatting note: Paragraphs, tables, images, slides and formulas are preserved byte-for-byte; complex inline run styling within single sentences is merged.',
 tSubject:'Subject',tSubjectPh:'Subject (e.g. Computer Science, Law, Medicine…)',subColSlide:'Slide',subColPage:'Page',
 pages:'pages',words:'words',slides:'slides',sheets:'sheets',rows:'rows',docAddedToGlossary:'terms added to Glossary',noTermsToReview:'No key terms to review',vAskLangAuto:'Auto (detect from question)',connFailed:'connection failed',
 vListenLabel:'Mic:',vTransLabel:'Translate:',tmEstimate:'estimate',tmPersistent:'Persistent',tmStandard:'Standard',
 secCreate:'CREATE',secTools:'TOOLS',secSystem:'SYSTEM',
 tabScreen:'Screen',tabGames:'Games',tabModels:'Model Hub',tabSettings:'Settings',
 statusOfflineReady:'Offline ready',statusOnlineOnly:'Online only',
 storageCardTitle:'Storage',screenTransLaunch:'Start Screen Translator (Ctrl+Shift+S)',screenTransConfig:'OCR Settings',
 openSettingsModels:'Manage Models',comingNextStep:'Coming in the next step',topbarSearchPh:'Search (disabled)',
 voicePrivateNote:'Private · audio processed locally',voiceSpeechError:'Speech recognition error',
 pageScreenTitle:'Screen',pageScreenSub:'Translate text on your screen, in videos and in games.',
 screenBrowserTitle:'Browser Mode',screenBrowserNotice:'Native screen capture requires the MAKAN Windows desktop app. In the browser, you can configure OCR & language settings, test preview translations, or review recent captures.',
 screenCaptureBtn:'Capture screen region',screenCaptureMode:'Capture mode',
 screenModeRegion:'Region',screenModeRegionDesc:'Select any area',
 screenModeFreeze:'Freeze frame',screenModeFreezeDesc:'Pause and inspect',
 screenModeClip:'Clipboard watcher',screenModeClipDesc:'Translate copied text',
 screenModeLive:'Live watcher',screenModeLiveDesc:'Follow changing text',
 screenOverlayToggle:'Show translation overlay',screenActiveReading:'Active reading:',
 screenLivePreview:'Live preview',screenRecentCaptures:'Recent captures',
 screenPrivacyLocal:'Processing stays on this PC',screenPrivacyCloud:'Online engine: text is sent only to the selected provider',
 screenNoCaptures:'No recent captures yet.',
 resetOrder:'Reset order',noKey:'no key',settingsAutoSaveMsg:'Settings are saved automatically',settingsAutoSaveHint:'Settings save automatically',savedNotice:'Saved',
 storageModelsUsed:'Offline models:',storageSiteTotal:'Site storage:',storagePrivacyNote:'Everything stored locally',catAll:'All models',catTranslate:'Translation',catSpeech:'Speech recognition',catVoices:'Voices',catOcr:'OCR',confirmDelete:'Click again to confirm',dlCancelled:'Download cancelled',cancel:'Cancel',
 wizardSkip:'Skip for now',wizardStep1Title:'Choose your language',wizardStep1Sub:'Select the primary language for the interface and default translations.',wizardStep2Title:'Choose your translation engine',wizardStep2Sub:'How would you like MAKAN Translate to process translations?',wizardEngineOfflineDesc:'Completely offline in your browser. Maximum privacy.',wizardEngineOllamaDesc:'Run open LLMs locally via Ollama (default: http://localhost:11434).',wizardEngineOnlineDesc:'Fast translation via Google, MyMemory, or free AI keys (Gemini, Groq).',wizardStep3Title:'Download offline models (optional)',wizardStep3Sub:'Download translation and speech recognition models for full offline use now, or do it later.',wizardPkgSkipDesc:'Keep setup fast. Download offline models anytime from the Model Hub.',wizardPkgLightDesc:'NLLB offline translation model (~600 MB).',wizardPkgFullDesc:'Translation (NLLB) + Speech recognition (Whisper) (~850 MB).',wizardStep4Title:'You’re all set!',wizardStep4Sub:'MAKAN Translate is configured and ready to use.',continue:'Continue',back:'Back',getStarted:'Get Started',openWizardBtn:'Welcome wizard',
 tabEnginesKeys:'Translation engines & keys',tabVoices:'Voices (reading aloud)',tabVoiceModels:'Voice models (speech recognition)',tabTrModels:'Translation models (offline)',tabOcr:'Screen reading (OCR)',tabDict:'Dictionary'
},fa:{
 engines:'موتورها و کلیدها',eyebrow:'متن · زیرنویس · سند · صدا',h1a:'یک مترجم،',h1b:'همه‌ی موتورها.',
 tabIdiom:'اصطلاحات',idPh:'یک اصطلاح یا ضرب‌المثل بنویسید…',idFindH:'پیدا کردن اصطلاح از روی معنی',idFindHint:'آنچه می‌خواهید بگویید را توصیف کنید، مثلاً «کسی که زیاد حرف می‌زند». به موتور هوش مصنوعی نیاز دارد.',idDescPh:'یک معنی را توصیف کنید…',idFindBtn:'پیدا کردن اصطلاح',idStored:'اصطلاح ذخیره‌شده',idAiH:'توضیح هوش مصنوعی',idMeaning:'معنی',idLiteral:'معنی تحت‌اللفظی',idEquivalent:'معادل طبیعی',idRegister:'سطح زبان',idExamples:'مثال‌ها',idNotIdiom:'هوش مصنوعی این را اصطلاح نمی‌داند.',idNoAiStored:'موتور هوش مصنوعی در دسترس نیست؛ فقط مدخل ذخیره‌شده نمایش داده می‌شود.',idNoAiNone:'این اصطلاح در فهرست ذخیره‌شده نیست و موتور هوش مصنوعی هم برای توضیح در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',idFindNoAi:'پیدا کردن اصطلاح از روی معنی با موتور هوش مصنوعی انجام می‌شود و هیچ موتوری در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',idSave:'ذخیره‌ی اصطلاح',idIdiomBadge:'اصطلاح',idAsking:'در حال پرسیدن از هوش مصنوعی…',idNoMatch:'اصطلاح مناسبی پیدا نشد.',idMarkTitle:'اصطلاح: برای دیدن معنی کلیک کنید',tabDict:'فرهنگ لغت',dictPh:'یک واژه بنویسید…',dictSearch:'جستجو',dictVulgar:'نمایش واژه‌های رکیک',dictAuto:'خودکار (تشخیص زبان)',dictHidden:'این واژه رکیک علامت خورده و پنهان است. برای دیدن آن «نمایش واژه‌های رکیک» را روشن کنید.',dictHiddenSome:'برخی مدخل‌ها (رکیک) پنهان هستند. برای دیدن آن‌ها «نمایش واژه‌های رکیک» را روشن کنید.',dictGetPack:'دریافت فرهنگ لغت',dictNoPack:'فرهنگ لغت آفلاین این زبان هنوز دانلود نشده است.',dictNotFound:'برای این واژه مدخلی پیدا نشد.',dictMyWords:'واژه‌های من',dictExport:'خروجی CSV',dictClear:'پاک کردن فهرست',dictLocalOnly:'فهرست واژه‌ها فقط در همین مرورگر ذخیره می‌شود.',dictSave:'ذخیره‌ی واژه',dictSaved:'ذخیره شد ✓',dictExplain:'توضیح با هوش مصنوعی',dictExplaining:'در حال پرسیدن از هوش مصنوعی…',dictNoAi:'موتور هوش مصنوعی در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',dictPhrases:'اصطلاحات و عبارت‌ها',dictForms:'شکل‌ها',dictAlso:'معنی‌های بیشتر (از فرهنگ لغت دیگر)',dictFormOf:'شکلی از',dictPackEnFa:'فرهنگ لغت · انگلیسی ← فارسی · حدود ۱٫۱ مگابایت',dictPackFaEn:'فرهنگ لغت · فارسی ← انگلیسی · حدود ۰٫۹ مگابایت',dictRemove:'حذف',dictPackNote:'فرهنگ لغت پس از دانلود بدون اینترنت کار می‌کند، حتی با حالت آفلاین. داده‌ها از ویکی‌واژه (CC BY-SA)؛ «درباره و منابع» را ببینید.',creditsBtn:'درباره و منابع',creditsText:'فرهنگ لغت آفلاین: داده‌ها از ویکی‌واژه (CC BY-SA 4.0 / GFDL) با Wiktextract و Kaikki.org؛ انتخاب مدخل‌ها با رتبه‌بندی wordfreq از Robyn Speer (CC BY-SA 4.0). این فرهنگ لغت با همان مجوز CC BY-SA منتشر می‌شود. ذکر منبع به معنای تأیید نیست. صداهای آفلاین: صداهای Piper از rhasspy/piper-voices (MIT) با ONNX Runtime Web (MIT) و واج‌نگار eSpeak NG (GPL-3.0-or-later؛ فایل‌هایش در vendor/piper است). صداهای امیر، گنجی، ال‌جی اسپیچ، کوری و کریستین با مجوز CC0 / مالکیت عمومی و صدای آلبا (دانشگاه ادینبرا) CC BY 4.0 است. مدل‌های ترجمه و گفتار آفلاین از Hugging Face می‌آیند و هر مدل مجوز خودش را دارد (مدل‌های NLLB-200 با مجوز CC BY-NC 4.0 هستند).',dictDownloading:'در حال دانلود…',dictAiAsk:'واژه یا عبارت زیر را برای زبان‌آموز توضیح بده: کاربرد، سطح رسمی بودن (رسمی، خنثی، محاوره‌ای یا عامیانه) و سه جمله‌ی مثال کوتاه همراه با ترجمه. مختصر باش.',tabText:'متن',tabSub:'زیرنویس',tabDoc:'سند',tabVoice:'صدا',tabCmp:'مقایسه',tabGls:'واژه‌نامه',tabHist:'تاریخچه',
 engine:'موتور',mode:'حالت',modeBoth:'هر دو (سریع ← هوشمند)',modeFast:'سریع',modeSmart:'هوشمند',fastLabel:'سریع',fromMemory:'از حافظه',showImproved:'نمایش نسخه بهتر',aiUnavailable:'هوش مصنوعی در دسترس نیست',waitingFor:'در انتظار',fastFailed:'موتورهای سریع ناموفق بودند؛ نتیجه هوشمند نمایش داده شد',aiRateLimited:'محدودیت هوش مصنوعی',tone:'لحن',toneN:'معمولی',toneF:'رسمی',toneC:'محاوره‌ای',toneT:'فنی',
 from:'از <bdi>(From)</bdi>',to:'به <bdi>(To)</bdi>',detectedPrefix:'تشخیص داده شد:',swapHint:'لطفاً ابتدا زبان را انتخاب یا تشخیص دهید',
 source:'متن اصلی',translation:'ترجمه',original:'اصلی',mic:'میکروفون',paste:'چسباندن',clear:'پاک کردن',stop:'توقف',translate:'ترجمه',speak:'خواندن',copy:'کپی',
 phIn:'متن را بنویسید یا بچسبانید…',phCmp:'متنی برای مقایسه بین موتورها…',
 sDrop:'فایل زیرنویس را اینجا رها کنید',sDrop2:'یا برای انتخاب کلیک کنید. زمان‌بندی دقیقاً حفظ می‌شود.',bilingual:'خروجی دوزبانه',sRest:'ترجمه‌ی خط‌های خالی',sAll:'ترجمه‌ی همه',
 dDrop:'فایل TXT، Markdown، JSON یا CSV را رها کنید',dDrop2:'ساختار دست‌نخورده می‌ماند: کلیدهای JSON، ستون‌های CSV و نشانه‌های Markdown تغییر نمی‌کنند.',dGo:'ترجمه‌ی فایل',download:'دانلود',
 vHint:'دو نفر، دو زبان. دکمه را بزنید، صحبت کنید؛ ترجمه نمایش داده و خوانده می‌شود.',vAuto:'ترجمه را بلند بخوان',noSR:'تشخیص گفتار در این مرورگر در دسترس نیست. از Chrome یا Edge استفاده کنید.',
 compare:'مقایسه',gHint:'واژه‌هایی که همیشه باید به شکل دلخواه شما ترجمه شوند: نام‌ها، برندها، اصطلاحات فنی. در همه‌ی بخش‌ها اعمال می‌شود.',gAdd:'+ افزودن واژه',
 hHint:'فقط در همین مرورگر ذخیره می‌شود.',hClear:'پاک کردن تاریخچه',foot:'کلیدها در مرورگر شما می‌مانند و فقط برای سرویس انتخابی شما فرستاده می‌شوند.',
 setNote:'موتورهای رایگان بدون تنظیم کار می‌کنند. برای کیفیت بهتر یک کلید رایگان (Gemini، Groq یا OpenRouter) اضافه کنید. در حالت خودکار موتورها از بالا به پایین امتحان می‌شوند و اگر یکی خطا بدهد بعدی جایگزین می‌شود.',
 mmEmail:'ایمیل MyMemory (اختیاری، سقف روزانه را بالا می‌برد)',
 auto:'خودکار (بهترین موجود)',detect:'تشخیص زبان',copied:'کپی شد',noEngine:'هیچ موتوری در دسترس نیست. «موتورها و کلیدها» را باز کنید.',
 failed:'خطا داد',switching:'جایگزین:',done:'انجام شد',stopped:'متوقف شد. خط‌های ترجمه‌شده حفظ شدند.',rateLimited:'به سقف مجاز درخواست رسیده‌اید. یک دقیقه صبر کنید و دوباره تلاش کنید.',lines:'خط',cues:'بخش',segments:'بخش',via:'با',chars:'نویسه',
 speakIn:'صحبت به',empty:'هنوز چیزی اینجا نیست.',test:'آزمایش',works:'کار می‌کند',getKey:'دریافت کلید',free:'رایگان',freekey:'کلید رایگان',paid:'پولی',custom:'سفارشی',
 key:'کلید API',model:'مدل',baseUrl:'نشانی پایه (سازگار با OpenAI)',needKey:'کلید لازم دارد',notHere:'در این مرورگر پشتیبانی نمی‌شود',term:'واژه',termTo:'همیشه ترجمه شود به',
 tipKey:'کار بزرگ روی موتور رایگان. با کلید رایگان Gemini یا Groq سریع‌تر و دقیق‌تر می‌شود.',pick2:'دست‌کم یک موتور انتخاب کنید.',sameLang:'برای این کار زبان مبدأ را انتخاب کنید.',offMode:'حالت آفلاین',voiceH:'صدا',sttL:'گفتار به متن (میکروفون)',sttAuto:'خودکار (بهترین موجود)',sttBrowser:'مرورگر (آنلاین)',sttGroq:'Groq Whisper (آنلاین، با کلید Groq)',sttWh:'Whisper در مرورگر (آفلاین)',
 ttsL:'متن به گفتار (خواندن)',ttsDev:'صداهای دستگاه / مرورگر',ttsApiO:'سرور گفتار (Sesame CSM، OpenAI…)',preset:'پیش‌تنظیم',voiceName:'نام صدا',ttsTest:'آزمایش صدا',voiceFor:'صدا برای',autoVoice:'خودکار (بهترین)',
 ttsHint:'هر سروری که نقطه‌ی ‎/audio/speech‎ به سبک OpenAI داشته باشد کار می‌کند. Sesame CSM باید روی رایانه‌ای با کارت گرافیک NVIDIA اجرا شود؛ سرور را روشن کنید و «آزمایش صدا» را بزنید. اگر سرور در دسترس نباشد از صدای دستگاه استفاده می‌شود.',
 edgeHint:'نکته: مرورگر Microsoft Edge صداهای طبیعی رایگان برای فارسی و بسیاری زبان‌های دیگر دارد. در Chrome فهرست به صداهای نصب‌شده در ویندوز بستگی دارد.',
 tmH:'حافظه ترجمه',tmNote:'ذخیره‌سازی محلی ترجمه‌ها در مرورگر. هنگام فعال بودن، ترجمه‌های پیشین بدون نیاز به موتور دوباره استفاده می‌شوند.',tmSavedCount:'ترجمه‌های ذخیره‌شده:',tmClear:'پاک کردن حافظه',tmClearSure:'برای پاک‌سازی دوباره کلیک کنید',tmCleared:'حافظه ترجمه پاک شد',fromCorrection:'ویرایش شما',saveCorrection:'ذخیره ویرایش شما',correctionSaved:'ویرایش در حافظه ذخیره شد',tmEstimate:'تخمینی',tmPersistent:'دائمی',tmStandard:'استاندارد',
 offH:'آفلاین',offNote:'یک بار با اینترنت دانلود کنید، سپس بدون اینترنت ترجمه کنید. مدل‌ها در همین مرورگر می‌مانند. حالت آفلاین فقط از مدل‌هایی که اینجا دانلود می‌کنید، مترجم داخلی Chrome، Ollama و سرورهای محلی استفاده می‌کند.',
 offTr:'مدل ترجمه · NLLB، ۲۰۰ زبان · حدود ۹۰۰ مگابایت',offAsr:'مدل گفتار · Whisper (حدود ۸۰ مگابایت WASM / حدود ۱۵۵ مگابایت WebGPU)',ready:'آماده',notDl:'دانلود نشده',dlDone:'دانلود تمام شد. آماده‌ی استفاده‌ی آفلاین.',
 needDl:'ابتدا دانلود کنید (موتورها و کلیدها ← آفلاین)',needUrl:'نشانی لازم دارد',needModel:'یک مدل انتخاب کنید',install:'نصب',local:'محلی',offline:'آفلاین',
 ollamaHint:'Ollama را نصب کنید، دستور «ollama pull gemma3» را اجرا کنید و سپس «مدل‌ها» را بزنید. اگر Ollama هنوز در دسترس نیست، متغیر OLLAMA_ORIGINS={origin} را در ویندوز تنظیم و Ollama را دوباره اجرا کنید.',
 customHint:'LM Studio: http://localhost:1234/v1 · هر سرور سازگار با OpenAI کار می‌کند.',
 noOff:'هیچ موتور آفلاینی آماده نیست. در «موتورها و کلیدها» ← آفلاین مدل را دانلود کنید یا Ollama را راه‌اندازی کنید.',offHelp:'حالت آفلاین: مدل ترجمه را در موتورها و کلیدها دانلود کنید یا Ollama را اجرا کنید.',micBlocked:'میکروفون مسدود است',voiceUsed:'صدا',voiceDevice:'دستگاه',geminiWord:'جمینای',geminiVoicesGrp:'صداهای جمینای',deviceVoicesGrp:'این دستگاه',edgeHint:'مایکروسافت اج برای این زبان صدای طبیعی داخلی دارد.',noVoiceNoKey:'برای این زبان صدایی روی این دستگاه نیست و کلید Gemini هم تنظیم نشده است. کلید Gemini را در «موتورها و کلیدها» وارد کنید یا Microsoft Edge را امتحان کنید.',noVoice:'برای این زبان صدایی روی این دستگاه نیست. Microsoft Edge را امتحان کنید یا صدای زبان را در ویندوز نصب کنید.',ttsFallback:'از صدای دستگاه استفاده شد',
 loadModels:'مدل‌ها',
 vModeConv:'گفتگو',vModeAsk:'پرسش از هوش مصنوعی',
 vLive:'زنده',vLiveHint:'مکالمه‌ی مداوم و بدون نیاز به فشردن دکمه',vLiveListening:'در حال شنیدن…',vLiveListenBrowser:'در حال شنیدن (نوبتی — برای تغییر گوینده ضربه بزنید)…',vLiveListenDetect:'در حال شنیدن (تشخیص خودکار زبان)…',vLiveTranslating:'در حال ترجمه…',vLiveSpeaking:'در حال خواندن…',vStopLive:'توقف زنده',
 vBrowserNoDetect:'تشخیص خودکار زبان پیش از شنیدن در موتور مرورگر ممکن نیست. انتخاب کنید چه کسی صحبت می‌کند:',
 vFileProtoNotice:'مرورگرها اجازه دسترسی به میکروفون را برای فایل‌های محلی (//:file) ذخیره نمی‌کنند. در صورت اجرای روی localhost یا وب‌سایت، این اجازه به خاطر سپرده می‌شود.',
 stopSpeak:'قطع صدا',replay:'پخش دوباره',speed:'سرعت',
 vAskHint:'با صدا یا نوشتن سؤال بپرسید؛ هوش مصنوعی پاسخ داده و بلند می‌خواند.',vAskPh:'سؤالتان را بپرسید یا بنویسید…',vAskSend:'پرسش',vAskNew:'گفتگوی جدید',vAskLang:'زبان پاسخ',vAskThinking:'در حال اندیشیدن…',
 noAiEngine:'هیچ موتور هوش مصنوعی آماده نیست. «موتورها و کلیدها» را باز کنید.',
 checkConn:'بررسی اتصال‌ها',connChecking:'در حال بررسی…',connWorks:'کار می‌کند',connNeedsKey:'نیاز به کلید دارد',connKeyRejected:'کلید رد شد',connNetBlocked:'از شبکه شما قابل دسترسی نیست',connCors:'مسدود شده توسط مرورگر (CORS)',connLocalDown:'روی این رایانه در حال اجرا نیست — آن را روشن کرده و دوباره بررسی کنید',
 exportForExt:'خروجی برای افزونه',settingsExported:'تنظیمات برای افزونه ذخیره شد!',
 ttsGemini:'صوت گوگل جِمینای',ttsOpenAI:'صوت OpenAI',sttGemini:'جمینای (آنلاین، با کلید جمینای)',regionBlocked:'این سرویس از شبکه شما در دسترس نیست (مسدود شده است).',groqKeyWarn:'⚠️ کلیدهای Groq معمولاً با «gsk_» شروع می‌شوند. لطفاً کلید کنسول Groq را بررسی کنید.',
 pttTalk:'فشار دهید و صحبت کنید',pttHold:'نگه دارید و صحبت کنید · رها کنید برای ارسال · کلید Space یا ضربه',
 pttListeningHold:'در حال شنیدن… (رها کنید برای ارسال)',pttListeningTap:'در حال شنیدن… (برای ارسال دوباره ضربه بزنید یا Space را بزنید)',
 micActive:'میکروفون فعال',micRecording:'در حال ضبط',
 subStyle:'سبک',subStyleFilm:'فیلم / محاوره‌ای',subStyleNeutral:'معمولی',subStyleFormal:'رسمی',
 subFamily:'مناسب خانواده (تعدیل فحش و اصطلاحات تند)',
 subNonAiWarn:'⚠️ موتورهای غیرهوش مصنوعی (گوگل، مای‌مموری و آفلاین) قادر به اعمال لحن محاوره‌ای یا سبک فیلم نیستند. برای زیرنویس محاوره‌ای فیلم از موتور هوش مصنوعی استفاده کنید.',
 subChangeFile:'تغییر فایل',outFormat:'فرمت خروجی',outSame:'مثل ورودی',outWord:'ورد (.docx)',outPdf:'پی‌دی‌اف (.pdf)',outMd:'مارک‌داون (.md)',outTxt:'متن ساده (.txt)',outTooLong:'این سند برای خروجی PDF خیلی بلند است. ورد یا فرمت دیگری را انتخاب کنید.',subCloseFile:'بستن فایل',subCloseSure:'برای دورریختن ترجمه دوباره کلیک کنید',subColNum:'ردیف',subColTime:'زمان‌بندی',subColOrig:'متن اصلی',subColTrans:'ترجمه',
 silenceWaitL:'مکث تشخیص پایان گفتار',liveVoice:'صدای حالت زنده',vAudioInputLabel:'ورودی صدا',vAudioInputL:'ورودی صدا (میکروفون یا صدای سیستم/ویدیو)',fastVoice:'سریع (صدای دستگاه / اج)',qualityVoice:'کیفیت بالا (صدای جمینای)',
 saveConv:'ذخیره گفتگو',convSaved:'گفتگو در فایل متنی ذخیره شد',convCleared:'گفتگو پاک شد',settings:'تنظیمات',
 readAloud:'خواندن با صدا',enabled:'فعال',vStatusReady:'آماده · برای صحبت نگه دارید',vStatusListening:'در حال شنیدن…',
 vStatusWorking:'در حال ترجمه…',vStatusSpeaking:'در حال خواندن ترجمه…',vStatusPreparing:'در حال آماده‌سازی صدا…',vPreparingPtt:'در حال آماده‌سازی…',vPreparingTapStop:'برای لغو ضربه بزنید',vStatusError:'خطا',
 vEmptyTitle:'مکالمه صوتی دوزبانه',vEmptyDesc:'دکمه را نگه دارید و صحبت کنید؛ سخن شما ترجمه شده و خوانده می‌شود.',
 vTipNoKey:'از گفتار و ترجمه‌ی رایگان مرورگر استفاده می‌شود. برای دقت بالاتر و صدای طبیعی‌تر، یک کلید رایگان جمینای یا گروک در «موتورها و کلیدها» اضافه کنید.',
 vTipHasKey:'موتور هوش مصنوعی برای صدای طبیعی و سرعت بالا فعال است.',
 vAskNoAiTitle:'راه‌اندازی دستیار هوش مصنوعی',vAskNoAiDesc:'پرسش از هوش مصنوعی نیازمند کلید هوش مصنوعی (جمینای، گروک یا اوپن‌روتر) است. کلیدهای رایگان بدون هزینه کار می‌کنند.',
 vAskEmptyTitle:'دستیار صوتی هوش مصنوعی',vAskEmptyDesc:'با صدا یا نوشتن به هر زبانی سؤال بپرسید؛ هوش مصنوعی پاسخ داده و بلند می‌خواند.',
 vAskStatusReady:'آماده · سؤالتان را بپرسید',micLowWarn:'صدا بسیار ضعیف است. لطفاً نزدیک‌تر به میکروفون صحبت کنید.',
 retranslate:'ترجمه مجدد',tapToEdit:'برای ویرایش و ترجمه مجدد کلیک کنید',speakerA:'گوینده ۱',speakerB:'گوینده ۲',
 pttReleaseSend:'رها کنید برای ارسال',pttTapStop:'برای ارسال ضربه بزنید',working:'در حال ترجمه…',workingWait:'در حال ترجمه صوت · لطفاً صبر کنید',
 vSpeakingPtt:'در حال خواندن…',vSpeakingTapStop:'برای صحبت و قطع صدا دکمه را بزنید',retry:'تلاش دوباره',tapToRetry:'برای تلاش دوباره ضربه بزنید',
 timeoutListening:'مهلت شنیدن به پایان رسید',timeoutWorking:'مهلت ترجمه به پایان رسید',noVoiceWarn:'برای این زبان صدایی روی دستگاه نصب نیست. از مایکروسافت اج استفاده کنید یا در تنظیمات ویندوز بسته صوتی را نصب کنید.',talk:'صحبت',
 docOffice:'سند و آفیس',pdfNotSupported:'ترجمه فایل‌های PDF هنوز پشتیبانی نمی‌شود. لطفاً آن را به ورد (.docx) تبدیل کنید یا از متنی/مارک‌داون استفاده کنید.',
 docSubject:'موضوع و حوزه تخصصی',docSubjectAuto:'خودکار (تشخیص از روی سند)',docRegister:'لحن و سیاق متن',docRegNeutral:'معمولی / استاندارد',docRegTechnical:'فنی / تخصصی',docRegFormal:'رسمی / دانشگاهی',docRegCasual:'محاوره‌ای / عامیانه',
 docKeyTerms:'واژگان و اصطلاحات کلیدی',docAddTerm:'+ افزودن واژه',docAddToGlossary:'+ افزودن به واژه‌نامه',docTermsSaved:'واژگان به واژه‌نامه اضافه شدند',docAnalyzing:'در حال تحلیل موضوع و اصطلاحات کلیدی سند…',
 docReviewTerms:'بررسی در متن',docReviewing:'در حال بررسی اصطلاحات در بافت متن…',docReviewDone:'بررسی اصطلاحات انجام شد: {n} مورد بازبینی شد.',
 docKeepLayout:'حفظ چینش صفحات',
 docNotes:'یادداشت‌های مترجم',docNotesDesc:'افزودن پانویس یا یادداشت اسلاید برای اصطلاحات تخصصی و نکات فرهنگی',docEstSize:'حجم تخمینی',
 docSegments:'بخش',docWords:'کلمه',docPagesEst:'صفحه',docSlidesEst:'اسلاید',docRowsEst:'سطر',
 docEngineNoticeText:'تحلیل خودکار موضوع و یادداشت‌های مترجم نیازمند موتور هوش مصنوعی است. با موتورهای معمولی، ترجمه استاندارد و واژه‌نامه اعمال می‌شود.',
 docFormattingNote:'نکته قالب‌بندی: پاراگراف‌ها، جدول‌ها، تصاویر، اسلایدها و فرمول‌ها عینا حفظ می‌شوند؛ قالب‌بندی‌های تکه‌تکه درون جملات برای یکپارچگی ترکیب می‌شوند.',
 tSubject:'موضوع',tSubjectPh:'موضوع (مثلاً کامپیوتر، حقوق، پزشکی…)',subColSlide:'اسلاید',subColPage:'صفحه',
 pages:'صفحه',words:'کلمه',slides:'اسلاید',sheets:'برگه',rows:'سطر',docAddedToGlossary:'به واژه‌نامه اضافه شد',noTermsToReview:'واژه‌ای برای بررسی وجود ندارد',vAskLangAuto:'خودکار (تشخیص از روی پرسش)',connFailed:'خطا در اتصال',
 vListenLabel:'میکروفون:',vTransLabel:'ترجمه:'
}};
Object.assign(I18N.en,{
 mdlGrpListen:'Listening · speech to text (Whisper)',mdlGrpTr:'Translation',mdlGrpSpeak:'Speaking · text to speech',
 mdlPairs:'Small single-pair models: fast and light, but only for the one pair they are named for.',mdlPairsPrefer:'Use a small pair model when one is downloaded for the pair (faster, usually lower quality)',
 mdlSize:'Download',mdlMem:'Memory',mdlGpu:'WebGPU',mdlLangs:'Languages',mdlGpuNo:'not needed',mdlGpuOpt:'optional, faster if your browser has it (not tested by the developer)',
 mdlSizeTip:'Size of the files this browser downloads, taken from the Hugging Face model page.',mdlMemTip:'Highest memory use measured while running this model on a 4-core test computer. Your computer may use somewhat more or less.',
 mdlRecNonEn:'Recommended for languages other than English',mdlWeak:'Mostly English; weak in other languages',
 mdlDelete:'Delete',mdlUse:'Use',mdlInUse:'In use',mdlDeleted:'deleted from this browser',mdlDownloading:'Downloading…',
 fgOpt:'Finglish · Persian in Latin letters',fgSpelling:'Persian spelling',fgNeedsAi:'Finglish (Persian written in Latin letters) needs an AI engine. Add a free Gemini or Groq key in Engines & keys.',fgVia:'Finglish → Persian',
 mdlOfflineVoice:'offline voice',mdlSpeed:'Speed',mdlSpeedUnit:'s of waiting per second of speech (test computer, no WebGPU)',mdlEngineOnce:'speech engine, once',offlineVoicesGrp:'Offline voices (downloaded)',noVoiceOffline:'Or download an offline voice in Engines & keys → Offline.',
 mdlTotal:'Stored on this device by these models',mdlSiteTotal:'all data of this site',vTranscribing:'Transcribing…',
 offTrModel:'Offline translation model',offWhisperModel:'Offline speech model',autoMdl:'Auto',
 mdlUnsupportedFallback:'“{model}” does not support {pair}. Using Auto.',
 testModelsH:'Test models',testModelsDesc:'Compare downloaded models side by side on a sample sentence or speech clip.',
 testTrBtn:'Test translation models',testAsrBtn:'Test speech model',testSentencePh:'Sentence to translate…',
 testRunning:'Running…',testStopped:'Stopped',testDone:'Finished',
 testNoTrModels:'No offline translation models downloaded.',testNoAsrModels:'No offline speech models downloaded.',
 testColModel:'Model',testColResult:'Result',testColTime:'Time (s)',testRecPrompt:'Recording short clip… speak now',
 ollamaMgr:'Ollama models',ollamaInstalled:'Installed models',ollamaChooseModel:'Choose model for translation',
 ollamaRecommended:'Recommended',ollamaCustomPh:'Model name (e.g. translategemma:4b)',
 ollamaPulling:'Downloading',ollamaPullDone:'Download finished',ollamaPullCancel:'Cancel',ollamaPullCancelled:'Download cancelled',
 ollamaUnreachableTitle:'Ollama is not reachable',
 ollamaUnreachableMsg:'Start Ollama by running “ollama serve” in terminal or launch the Ollama app. If Ollama is not already reachable, set OLLAMA_ORIGINS={origin} in Windows environment variables and restart Ollama after.',
 ollamaAsrNotice:'Note: Speech models like Qwen3-ASR and Whisper large-v3 run through the Python ASR helper (available in Voice settings).',
 sttHelper:'Python ASR Helper (Whisper large-v3 / Qwen3-ASR)',
 helperUrlL:'Helper Server Address',
 helperModelL:'Speech Model',
 helperStatusL:'Helper Status',
 helperConnected:'Helper connected',
 helperOffline:'Helper offline (start Python helper)',
 helperCheckBtn:'Check',helperDlBtn:'Download / Load Model',
 allVoicesH:'Available voices',previewVoice:'Preview',voiceFallbackAuto:'Selected voice is unavailable. Using Auto.',offlineVoicesAvailable:'Offline voices (available for download)',autoVoiceDesc:'Automatically picks the best voice for each language',notDownloaded:'Not downloaded',dlBtn:'Download',voiceOffline:'Offline voice',
 screenTrans:'Screen Translator',screenTransH:'Screen Translator (Windows OCR)',
 screenTransNote:'Capture any region of your screen to recognize text with native Windows OCR and translate instantly.',
 screenTransEnable:'Enable Screen Translator',screenTransHotkey:'Global Shortcut',
 screenTransOcrEngine:'OCR Engine',screenTransFreezeFrame:'Freeze-Frame Snipping Tool',
 screenTransClipboardWatcher:'Clipboard Watcher (Auto-translate screenshots)',
 stActiveLabel:'Active Reading:',mdlGrpOcr:'OCR & Screen Reading',
 screenTransOcrLang:'Windows OCR Language',screenTransTgtLang:'Default Target Language',
 screenTransAutoCopy:'Copy translated text automatically',screenTransSaveHist:'Save OCR translations to History',
 screenTransOcrModel:'OCR Recognition Model',screenTransOcrModelDl:'Download Model',screenTransReturnToApp:'Return to app after capture',
 testScreenTransBtn:'Capture Screen Region Now'
});
Object.assign(I18N.fa,{
 tabEnginesKeys:'موتورهای ترجمه و کلیدها',tabVoices:'صداها (خواندن با صدای بلند)',tabVoiceModels:'مدل‌های صوتی (تشخیص گفتار)',tabTrModels:'مدل‌های ترجمه (آفلاین)',tabOcr:'خوانش تصویر و صفحه (OCR)',
 mdlGrpListen:'شنیدن · گفتار به متن (Whisper)',mdlGrpTr:'ترجمه',mdlGrpSpeak:'گفتن · متن به گفتار',
 mdlPairs:'مدل‌های کوچک تک‌جفتی: سریع و سبک، ولی فقط برای همان جفت زبانی که نامشان نشان می‌دهد.',mdlPairsPrefer:'اگر برای این جفت زبان مدل کوچک دانلود شده، از آن استفاده کن (سریع‌تر، معمولاً با کیفیت کمتر)',
 mdlSize:'دانلود',mdlMem:'حافظه',mdlGpu:'WebGPU',mdlLangs:'زبان‌ها',mdlGpuNo:'لازم نیست',mdlGpuOpt:'اختیاری، اگر مرورگر داشته باشد سریع‌تر است (توسط توسعه‌دهنده آزمایش نشده)',
 mdlSizeTip:'حجم فایل‌هایی که این مرورگر دانلود می‌کند، از صفحه‌ی مدل در Hugging Face.',mdlMemTip:'بیشترین حافظه‌ی مصرفی در اجرای این مدل روی یک رایانه‌ی آزمایشی ۴ هسته‌ای. رایانه‌ی شما ممکن است کمی بیشتر یا کمتر مصرف کند.',
 mdlRecNonEn:'برای زبان‌های غیر از انگلیسی توصیه می‌شود',mdlWeak:'بیشتر برای انگلیسی؛ در زبان‌های دیگر ضعیف',
 mdlDelete:'حذف',mdlUse:'استفاده',mdlInUse:'در حال استفاده',mdlDeleted:'از این مرورگر حذف شد',mdlDownloading:'در حال دانلود…',
 fgOpt:'فینگلیش · فارسی با حروف لاتین',fgSpelling:'املای فارسی',fgNeedsAi:'فینگلیش (فارسی با حروف لاتین) به یک موتور هوش مصنوعی نیاز دارد. در «موتورها و کلیدها» یک کلید رایگان Gemini یا Groq اضافه کنید.',fgVia:'فینگلیش ← فارسی',
 mdlOfflineVoice:'صدای آفلاین',mdlSpeed:'سرعت',mdlSpeedUnit:'ثانیه انتظار برای هر ثانیه گفتار (رایانه‌ی آزمایشی، بدون WebGPU)',mdlEngineOnce:'موتور گفتار، یک بار',offlineVoicesGrp:'صداهای آفلاین (دانلودشده)',noVoiceOffline:'یا در «موتورها و کلیدها ← آفلاین» یک صدای آفلاین دانلود کنید.',
 mdlTotal:'فضای اشغال‌شده در این دستگاه توسط این مدل‌ها',mdlSiteTotal:'کل داده‌های این سایت',vTranscribing:'در حال تبدیل گفتار به متن…',
 offTrModel:'مدل ترجمه‌ی آفلاین',offWhisperModel:'مدل گفتار آفلاین',autoMdl:'خودکار',
 mdlUnsupportedFallback:'مدل «{model}» از {pair} پشتیبانی نمی‌کند؛ از حالت خودکار استفاده شد.',
 testModelsH:'آزمایش مدل‌ها',testModelsDesc:'مقایسه‌ی مدل‌های دانلودشده روی یک جمله‌ی نمونه یا فایل صوتی کوتاه.',
 testTrBtn:'آزمایش مدل‌های ترجمه',testAsrBtn:'Test speech model',testSentencePh:'جمله‌ای برای ترجمه…',
 testRunning:'در حال اجرا…',testStopped:'متوقف شد',testDone:'پایان یافت',
 testNoTrModels:'هیچ مدل ترجمه‌ی آفلاینی دانلود نشده است.',testNoAsrModels:'هیچ مدل گفتار آفلاینی دانلود نشده است.',
 testColModel:'مدل',testColResult:'نتیجه',testColTime:'زمان (ثانیه)',testRecPrompt:'در حال ضبط صدای کوتاه… اکنون صحبت کنید',
 ollamaMgr:'مدل‌های Ollama',ollamaInstalled:'مدل‌های نصب‌شده',ollamaChooseModel:'انتخاب مدل برای ترجمه',
 ollamaRecommended:'پیشنهادی',ollamaCustomPh:'نام مدل (مانند translategemma:4b)',
 ollamaPulling:'در حال دانلود',ollamaPullDone:'دانلود تمام شد',ollamaPullCancel:'لغو',ollamaPullCancelled:'دانلود لغو شد',
 ollamaUnreachableTitle:'Ollama در دسترس نیست',
 ollamaUnreachableMsg:'برای اجرا در ترمینال دستور «ollama serve» را بزنید یا برنامه Ollama را باز کنید. اگر Ollama هنوز در دسترس نیست، متغیر OLLAMA_ORIGINS={origin} را در ویندوز تنظیم و Ollama را دوباره اجرا کنید.',
 ollamaAsrNotice:'توجه: مدل‌های صوتی مانند Qwen3-ASR و Whisper large-v3 از طریق دستیار کمکی پایتون اجرا می‌شوند (در تنظیمات صدا در دسترس است).',
 sttHelper:'دستیار صوتی پایتون (Whisper large-v3 و Qwen3-ASR)',
 helperUrlL:'نشانی سرور کمکی',
 helperModelL:'مدل گفتار',
 helperStatusL:'وضعیت دستیار کمکی',
 helperConnected:'دستیار کمکی متصل است',
 helperOffline:'دستیار کمکی خاموش است (سرور کمکی را روشن کنید)',
 helperCheckBtn:'بررسی',helperDlBtn:'دانلود و بارگذاری مدل',
 allVoicesH:'صداهای موجود',previewVoice:'پیش‌شنوایی',voiceFallbackAuto:'صدای انتخاب‌شده در دسترس نیست؛ از حالت خودکار استفاده شد.',offlineVoicesAvailable:'صداهای آفلاین (آماده دانلود)',autoVoiceDesc:'انتخاب خودکار بهترین صدا برای هر زبان',notDownloaded:'دانلود نشده',dlBtn:'دانلود',voiceOffline:'صدای آفلاین',
 screenTrans:'مترجم صفحه',screenTransH:'مترجم صفحه نمایش (OCR ویندوز)',
 screenTransNote:'هر بخش از صفحه نمایش را انتخاب کنید تا با OCR داخلی ویندوز خوانده شده و با موتورهای ماکان ترجمه شود.',
 screenTransEnable:'فعال‌سازی مترجم صفحه',screenTransHotkey:'کلید میانبر سراسری',
 screenTransOcrEngine:'موتور OCR',screenTransFreezeFrame:'ابزار برش تصویر ثابت',
 screenTransClipboardWatcher:'دیده‌بان کلیپ‌بورد (ترجمه خودکار تصویر برش‌خورده)',
 stActiveLabel:'خوانش فعال:',mdlGrpOcr:'خوانش تصویر و صفحه (OCR)',
 screenTransOcrLang:'زبان OCR ویندوز',screenTransTgtLang:'زبان مقصد پیش‌فرض',
 screenTransAutoCopy:'کپی خودکار متن ترجمه شده',screenTransSaveHist:'ذخیره ترجمه‌های OCR در تاریخچه',
 screenTransOcrModel:'مدل بازشناسی متنی OCR',screenTransOcrModelDl:'دانلود مدل',screenTransReturnToApp:'بازگشت به برنامه پس از تصویربرداری',
 testScreenTransBtn:'انتخاب و ترجمه بخشی از صفحه',
 secCreate:'ایجاد',secTools:'ابزارها',secSystem:'سیستم',
 tabScreen:'صفحه',tabGames:'بازی‌ها',tabModels:'مرکز مدل‌ها',tabSettings:'تنظیمات',
 statusOfflineReady:'آماده آفلاین',statusOnlineOnly:'فقط آنلاین',
 storageCardTitle:'فضای ذخیره‌سازی',screenTransLaunch:'شروع مترجم صفحه (Ctrl+Shift+S)',screenTransConfig:'تنظیمات نویسه‌خوان (OCR)',
 openSettingsModels:'مدیریت مدل‌ها',comingNextStep:'در مرحله بعد اضافه می‌شود',topbarSearchPh:'جستجو (غیرفعال)'
,pageTranslateTitle:'ترجمه',pageTranslateSub:'ترجمه متن با موتورهای هوش مصنوعی، آنلاین یا آفلاین.',pageSubTitle:'زیرنویس',pageSubSub:'ترجمه فایل‌های srt و vtt، یا ساخت زیرنویس از ویدئو.',pageDocTitle:'اسناد',pageDocSub:'ترجمه فایل‌های ورد، پاورپوینت، اکسل، متن، مارک‌داون، CSV و JSON.',pageVoiceTitle:'صدا',pageVoiceSub:'صحبت کنید و ترجمه را بشنوید.',pageVoiceSubOffline:'صحبت کنید و ترجمه را بشنوید، آفلاین.',vSttPrefix:'تشخیص گفتار:',vVoicePrefix:'صدا:',voiceReady:'آماده',voiceNotReady:'آماده نیست',voiceNoMic:'میکروفون مسدود است',voiceNoSR:'تشخیص گفتار در دسترس نیست',voiceNoModel:'مدل دانلود نشده',voiceNoHelper:'دستیار گفتار متصل نیست',voiceNoKey:'کلید API لازم است',voiceNoTrans:'موتور ترجمه آماده نیست',voiceNoVoice:'صدایی برای زبان مقصد وجود ندارد',holdHint:'نگه دارید',noMicrophone:'میکروفونی پیدا نشد',liveConversation:'گفت‌وگوی زنده',docDropTitle:'فایل سند را اینجا رها کنید',docDropBrowse:'یا برای انتخاب کلیک کنید',docSummaryTitle:'خلاصه ترجمه',subVideoTitle:'ساخت زیرنویس از فایل ویدئویی یا صوتی',subVideoComingSoon:'به‌زودی',subVideoHelperNote:'نیاز به دستیار گفتار محلی دارد',transMemory:'حافظه ترجمه',translatedChip:'ترجمه شد',cardSwap:'جابجایی',noVoiceInstalled:'صدایی نصب نیست',recentTranslations:'ترجمه‌های اخیر',viewAll:'مشاهده همه',noRecentTranslations:'هنوز ترجمه‌ای در تاریخچه نیست.',statusOfflineAvail:'موتورهای آفلاین در دسترس است',statusOnlineActive:'موتورهای اینترنتی فعال است',statusNotDownloaded:'دانلود نشده',statusReady:'آماده است',statusOllamaReady:'Ollama آماده است',statusOllamaDown:'Ollama در دسترس نیست',
voicePrivateNote:'خصوصی · پردازش صدا در دستگاه',voiceSpeechError:'خطای تشخیص گفتار',
pageScreenTitle:'صفحه نمایش',pageScreenSub:'ترجمه متن روی صفحه، در ویدئوها و بازی‌ها.',
screenBrowserTitle:'حالت مرورگر',screenBrowserNotice:'تصویربرداری بومی از صفحه به برنامه ویندوز MAKAN نیاز دارد. در مرورگر می‌توانید تنظیمات نویسه‌خوان و زبان را پیکربندی کرده یا ترجمه‌های اخیر را بررسی کنید.',
screenCaptureBtn:'انتخاب ناحیه صفحه',screenCaptureMode:'حالت تصویربرداری',
screenModeRegion:'ناحیه',screenModeRegionDesc:'انتخاب هر ناحیه',
screenModeFreeze:'توقف تصویر',screenModeFreezeDesc:'توقف و بررسی',
screenModeClip:'پایش کلیپ‌بورد',screenModeClipDesc:'ترجمه متن کپی‌شده',
screenModeLive:'پایش زنده',screenModeLiveDesc:'دنبال کردن تغییرات متن',
screenOverlayToggle:'نمایش لایه ترجمه',screenActiveReading:'خواندن فعال:',
screenLivePreview:'پیش‌نمایش زنده',screenRecentCaptures:'تصاویر اخیر',
screenPrivacyLocal:'پردازش در همین رایانه انجام می‌شود',screenPrivacyCloud:'موتور آنلاین: متن فقط به ارائه‌دهنده انتخابی ارسال می‌شود',
screenNoCaptures:'هنوز تصویری در تاریخچه نیست.',
resetOrder:'بازنشانی ترتیب',noKey:'بدون کلید',settingsAutoSaveMsg:'تنظیمات به‌طور خودکار ذخیره می‌شوند',settingsAutoSaveHint:'تنظیمات به‌طور خودکار ذخیره می‌شوند',savedNotice:'ذخیره شد',
storageModelsUsed:'مدل‌های آفلاین:',storageSiteTotal:'فضای ذخیره‌سازی سایت:',storagePrivacyNote:'ذخیره‌سازی تماماً روی دستگاه',catAll:'همه مدل‌ها',catTranslate:'ترجمه',catSpeech:'تشخیص گفتار',catVoices:'صداها',catOcr:'نویسه‌خوان (OCR)',confirmDelete:'تأیید حذف',dlCancelled:'دانلود لغو شد',cancel:'لغو',
wizardSkip:'رد شدن',wizardStep1Title:'زبان خود را انتخاب کنید',wizardStep1Sub:'زبان اصلی برای رابط کاربری و ترجمه‌های پیش‌فرض را مشخص کنید.',wizardStep2Title:'موتور ترجمه خود را انتخاب کنید',wizardStep2Sub:'مایلید مترجم ماکان چگونه متن‌های شما را پردازش کند؟',wizardEngineOfflineDesc:'کاملاً آفلاین درون مرورگر شما با بالاترین حریم خصوصی.',wizardEngineOllamaDesc:'اجرای مدل‌های هوش مصنوعی به‌صورت محلی با Ollama (پیش‌فرض: http://localhost:11434).',wizardEngineOnlineDesc:'ترجمه سریع با گوگل، MyMemory یا کلیدهای رایگان هوش مصنوعی (Gemini، Groq).',wizardStep3Title:'دانلود مدل‌های آفلاین (اختیاری)',wizardStep3Sub:'مدل‌های ترجمه و گفتار را برای استفاده آفلاین دانلود کنید، یا بعداً از مرکز مدل‌ها دریافت نمایید.',wizardPkgSkipDesc:'راه‌اندازی فوری بدون دانلود. هرزمان خواستید از مرکز مدل‌ها دریافت کنید.',wizardPkgLightDesc:'مدل ترجمه آفلاین NLLB (حدود ۶۰۰ مگابایت).',wizardPkgFullDesc:'بسته کامل ترجمه (NLLB) و تشخیص گفتار (Whisper) (حدود ۸۵۰ مگابایت).',wizardStep4Title:'همه‌چیز آماده است!',wizardStep4Sub:'مترجم ماکان پیکربندی شد و آماده استفاده است.',continue:'ادامه',back:'بازگشت',getStarted:'شروع استفاده',openWizardBtn:'راهنمای راه‌اندازی'
});
let ui=store.get('ui','en');
const L=k=>I18N[ui][k]??I18N.en[k]??k;
function applyI18n(){
  document.documentElement.lang=ui;document.documentElement.dir=ui==='fa'?'rtl':'ltr';
  document.querySelectorAll('[data-t]').forEach(e=>e.textContent=L(e.dataset.t));
  document.querySelectorAll('[data-tp]').forEach(e=>e.placeholder=L(e.dataset.tp));
  $('uiLang').textContent=ui==='fa'?'English':'فارسی';
  if(typeof updateCardLangNames==='function')updateCardLangNames();
  if(typeof updateTextCounts==='function')updateTextCounts();
  if(typeof renderRecentTranslations==='function')renderRecentTranslations();
  if(typeof renderTextStatusStrip==='function')renderTextStatusStrip();
  if(typeof updateVoiceReadiness==='function')updateVoiceReadiness();
  if(typeof updateAllUnifiedPickers==='function')updateAllUnifiedPickers();
}

/* ---------- languages ---------- */
const LANGS=[
  ['en','انگلیسی · English'],['fa','فارسی · Persian'],['ar','العربية · Arabic'],['tr','Türkçe · Turkish'],
  ['de','Deutsch · German'],['fr','Français · French'],['es','Español · Spanish'],['it','Italiano · Italian'],
  ['pt','Português · Portuguese'],['ru','Русский · Russian'],['zh-CN','简体中文 · Chinese (Simplified)'],
  ['zh-TW','繁體中文 · Chinese (Traditional)'],['ja','日本語 · Japanese'],['ko','한국어 · Korean'],
  ['hi','हिन्दी · Hindi'],['ur','اردو · Urdu'],['ku','Kurdî · Kurdish'],['az','Azərbaycanca · Azerbaijani'],
  ['ps','پښتو · Pashto'],['tg','Тоҷикӣ · Tajik'],['hy','Հայերեն · Armenian'],['nl','Nederlands · Dutch'],
  ['sv','Svenska · Swedish'],['no','Norsk · Norwegian'],['da','Dansk · Danish'],['fi','Suomi · Finnish'],
  ['pl','Polski · Polish'],['uk','Українська · Ukrainian'],['cs','Čeština · Czech'],['ro','Română · Romanian'],
  ['hu','Magyar · Hungarian'],['el','Ελληνικά · Greek'],['he','עברית · Hebrew'],['id','Indonesia · Indonesian'],
  ['ms','Melayu · Malay'],['th','ไทย · Thai'],['vi','Tiếng Việt · Vietnamese'],['bn','বাংলা · Bengali']
];
const langName=c=>c==='auto'?'the detected language':c==='finglish'?'Persian (written in Latin letters)':((LANGS.find(l=>l[0]===c)||[])[1]||c).split(' · ').pop();
const langShort=c=>c==='finglish'?'Finglish':((LANGS.find(l=>l[0]===c)||[])[1]||c).split(' · ')[0];

function getLangNames(code){
  if(code==='auto')return {fa:'تشخیص خودکار',en:'Detect language'};
  if(code==='finglish')return {fa:'فینگلیش',en:'Finglish'};
  const pair=LANGS.find(l=>l[0]===code);
  if(pair&&pair[1].includes(' · ')){
    const parts=pair[1].split(' · ');
    return {fa:parts[0],en:parts[1]};
  }
  return {fa:code||'',en:code||''};
}

function formatLangDisplayHtml(code){
  const {fa,en}=getLangNames(code);
  return `<span class="lang-fa">${esc(fa)}</span> <bdi class="lang-en">${esc(en)}</bdi>`;
}

function detectRealLanguage(text){
  if(!text||typeof text!=='string')return null;
  const trimmed=text.trim();
  if(!trimmed)return null;

  if(!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\uAC00-\uD7AF\u4E00-\u9FFF\u0900-\u097F\u0590-\u05FF\u0E00-\u0E7F\u0370-\u03FF\u0530-\u058F\u0980-\u09FF]/.test(trimmed)){
    return null;
  }

  if(typeof detectFinglish==='function'&&detectFinglish(trimmed)){
    return null;
  }

  if(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(trimmed)){
    if(/[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/.test(trimmed))return 'fa';
    if(/[\u0629\u0649\u064A]/.test(trimmed))return 'ar';
    return 'fa';
  }
  if(/[\u0400-\u04FF]/.test(trimmed)){
    if(/[\u0456\u0457\u0454]/.test(trimmed))return 'uk';
    return 'ru';
  }
  if(/[\u3040-\u30FF]/.test(trimmed))return 'ja';
  if(/[\uAC00-\uD7AF]/.test(trimmed))return 'ko';
  if(/[\u4E00-\u9FFF]/.test(trimmed))return 'zh-CN';
  if(/[\u0900-\u097F]/.test(trimmed))return 'hi';
  if(/[\u0590-\u05FF]/.test(trimmed))return 'he';
  if(/[\u0E00-\u0E7F]/.test(trimmed))return 'th';
  if(/[\u0370-\u03FF]/.test(trimmed))return 'el';
  if(/[\u0530-\u058F]/.test(trimmed))return 'hy';
  if(/[\u0980-\u09FF]/.test(trimmed))return 'bn';

  const lower=' '+trimmed.toLowerCase().replace(/[^a-zà-ÿ]/g,' ')+' ';
  if(/\b(und|der|die|das|nicht|ist|ein|eine|mit|auf|für|von|sie|wir|aber|auch)\b/.test(lower)||/[äöüß]/.test(trimmed))return 'de';
  if(/\b(le|la|les|des|est|une|dans|pour|avec|sur|sont|que|qui|pas|plus|ce|cette)\b/.test(lower)||/[éèêëàâôûùç]/.test(trimmed))return 'fr';
  if(/\b(el|los|las|una|para|como|pero|con|por|este|esta|que|del|mas)\b/.test(lower)||/[ñáíóú¿¡]/.test(trimmed))return 'es';
  if(/\b(bir|ve|bu|için|olan|ile|da|de|çok|ama|var|yok|gibi)\b/.test(lower)||/[ğışİI]/.test(trimmed))return 'tr';
  if(/\b(non|sono|della|delle|questo|anche|con|per|gli|dei|nel|nella)\b/.test(lower)||/[àèéìíîòóùú]/.test(trimmed))return 'it';

  if(/\b(the|is|and|of|in|to|it|you|that|was|for|on|are|as|with|they|at|be|this|from|have|or|by|one|had|not|but|what|all|were|when|we|there|can|an|your|which|their|if|do|will|each|about|how|up|out|them|then|she|many|some|so|these|would|other|into|has|more|her|two|like|him|see|time|no|make|than|first|been|its|who|now|my|over|down|only|way|find|use|water|long|little|very|after|words|just|where|most|know)\b/.test(lower)){
    return 'en';
  }

  if(/^[a-zA-Z\s,.'!?"'-]+$/.test(trimmed) && trimmed.length >= 3){
    if(/\b(hello|world|good|morning|hi|please|thank|thanks|welcome|name|book|car|house|water|food|cat|dog|test|help|yes|ok)\b/i.test(trimmed)){
      return 'en';
    }
  }

  return null;
}

window.MakanLangPickers=window.MakanLangPickers||{};

function setupUnifiedLanguagePicker(options){
  if(!options)return null;
  const srcSelect=typeof options.srcSelect==='string'?document.getElementById(options.srcSelect):options.srcSelect;
  const tgtSelect=typeof options.tgtSelect==='string'?document.getElementById(options.tgtSelect):options.tgtSelect;
  const swapBtn=typeof options.swapBtn==='string'?document.getElementById(options.swapBtn):options.swapBtn;
  if(!srcSelect&&!tgtSelect)return null;

  const idPrefix=options.idPrefix||(srcSelect?srcSelect.id:(tgtSelect?tgtSelect.id:'picker'));

  let detectedLang=null;
  let srcWrapped=null;
  let tgtWrapped=null;

  function wrapSelect(sel,role){
    if(!sel)return null;
    sel.classList.add('unified-select');
    let parentBox=sel.closest('.unified-lang-box');
    let pickerWrap=sel.closest('.unified-lang-picker');

    if(!pickerWrap){
      pickerWrap=document.createElement('div');
      pickerWrap.className='unified-lang-picker';
      pickerWrap.setAttribute('data-picker-role',role);
      sel.parentNode.insertBefore(pickerWrap,sel);

      const topLine=document.createElement('div');
      topLine.className='lang-picker-topline';

      const lbl=document.createElement('label');
      lbl.className='lang-picker-lbl';
      lbl.htmlFor=sel.id;
      if(role==='src'){
        lbl.setAttribute('data-t','from');
        lbl.innerHTML=L('from');
      }else if(role==='tgt'){
        lbl.setAttribute('data-t','to');
        lbl.innerHTML=L('to');
      }else{
        lbl.textContent=options.label||'';
      }
      topLine.appendChild(lbl);

      if(role==='src'){
        const badge=document.createElement('span');
        badge.className='lang-detected-badge';
        badge.id=`${sel.id}-detected-badge`;
        badge.hidden=true;
        badge.innerHTML=`<span class="detected-prefix" data-t="detectedPrefix">${L('detectedPrefix')}</span> <span class="detected-val"></span>`;
        topLine.appendChild(badge);
      }

      pickerWrap.appendChild(topLine);

      parentBox=document.createElement('div');
      parentBox.className='unified-lang-box';
      pickerWrap.appendChild(parentBox);
      parentBox.appendChild(sel);
    }

    let display=parentBox.querySelector('.lang-picker-display');
    if(!display){
      display=document.createElement('div');
      display.className='lang-picker-display';
      display.setAttribute('aria-hidden','true');
      display.innerHTML=`<span class="lang-display-inner"></span><span class="lang-picker-arrow">▾</span>`;
      parentBox.insertBefore(display,sel);
    }

    function update(){
      const inner=display.querySelector('.lang-display-inner');
      if(inner){
        inner.innerHTML=formatLangDisplayHtml(sel.value);
      }
      if(role==='src'&&sel.value!=='auto'){
        const badge=pickerWrap.querySelector('.lang-detected-badge');
        if(badge)badge.hidden=true;
        detectedLang=null;
      }
    }

    sel.addEventListener('change',update);
    update();
    return {sel,pickerWrap,parentBox,display,update};
  }

  const pickerInstance={
    srcSelect,
    tgtSelect,
    swapBtn,
    get detectedLang(){return detectedLang;},
    set detectedLang(val){detectedLang=val;},

    setDetected(langCode){
      if(!srcSelect||srcSelect.value!=='auto'||!langCode){
        this.clearDetected();
        return;
      }
      detectedLang=langCode;
      if(srcWrapped&&srcWrapped.pickerWrap){
        const badge=srcWrapped.pickerWrap.querySelector('.lang-detected-badge');
        if(badge){
          const valEl=badge.querySelector('.detected-val');
          if(valEl)valEl.innerHTML=formatLangDisplayHtml(langCode);
          badge.hidden=false;
        }
      }
    },

    clearDetected(){
      detectedLang=null;
      if(srcWrapped&&srcWrapped.pickerWrap){
        const badge=srcWrapped.pickerWrap.querySelector('.lang-detected-badge');
        if(badge)badge.hidden=true;
      }
    },

    updateDisplays(){
      if(srcWrapped)srcWrapped.update();
      if(tgtWrapped)tgtWrapped.update();
      if(srcWrapped&&srcWrapped.pickerWrap){
        const lbl=srcWrapped.pickerWrap.querySelector('.lang-picker-lbl');
        if(lbl)lbl.innerHTML=L('from');
        const badgePrefix=srcWrapped.pickerWrap.querySelector('.detected-prefix');
        if(badgePrefix)badgePrefix.textContent=L('detectedPrefix');
        if(detectedLang){
          const valEl=srcWrapped.pickerWrap.querySelector('.detected-val');
          if(valEl)valEl.innerHTML=formatLangDisplayHtml(detectedLang);
        }
      }
      if(tgtWrapped&&tgtWrapped.pickerWrap){
        const lbl=tgtWrapped.pickerWrap.querySelector('.lang-picker-lbl');
        if(lbl)lbl.innerHTML=L('to');
      }
    }
  };

  srcWrapped=wrapSelect(srcSelect,'src');
  tgtWrapped=wrapSelect(tgtSelect,'tgt');

  if(swapBtn&&srcSelect&&tgtSelect){
    swapBtn.addEventListener('click',e=>{
      e.preventDefault();
      const curSrc=srcSelect.value;
      const curTgt=tgtSelect.value;

      if(curSrc!=='auto'&&curSrc!=='finglish'){
        srcSelect.value=curTgt;
        tgtSelect.value=curSrc;
        pickerInstance.clearDetected();
        srcSelect.dispatchEvent(new Event('change',{bubbles:true}));
        tgtSelect.dispatchEvent(new Event('change',{bubbles:true}));
        options.onChanged?.(srcSelect.value,tgtSelect.value);
      }else{
        if(detectedLang){
          srcSelect.value=curTgt;
          tgtSelect.value=detectedLang;
          pickerInstance.clearDetected();
          srcSelect.dispatchEvent(new Event('change',{bubbles:true}));
          tgtSelect.dispatchEvent(new Event('change',{bubbles:true}));
          options.onChanged?.(srcSelect.value,tgtSelect.value);
        }else{
          const msg=L('swapHint')||(ui==='fa'?'لطفاً ابتدا زبان را انتخاب یا تشخیص دهید':'Please select or detect a language first');
          if(typeof toast==='function')toast(msg,'warn');
        }
      }
    });
  }

  if(idPrefix){
    window.MakanLangPickers[idPrefix]=pickerInstance;
  }
  return pickerInstance;
}

function updateAllUnifiedPickers(){
  Object.values(window.MakanLangPickers||{}).forEach(p=>{
    if(p&&typeof p.updateDisplays==='function')p.updateDisplays();
  });
}
