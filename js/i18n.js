/* ---------- i18n ---------- */
const I18N={en:{
 pageTranslateTitle:'Translate',pageTranslateSub:'Translate text with AI engines, online or offline.',pageSubTitle:'Subtitles',pageSubSub:'Translate .srt and .vtt files, or make subtitles from a video',pageDocTitle:'Documents',pageDocSub:'Translate Word, PowerPoint, Excel, text, Markdown, CSV and JSON files.',pageVoiceTitle:'Voice',pageVoiceSub:'Talk and hear the translation.',pageVoiceSubOffline:'Talk and hear the translation, offline.',vSttPrefix:'Speech recognition:',vVoicePrefix:'Voice:',voiceReady:'Ready',voiceNotReady:'Not ready',voiceNoMic:'Microphone blocked',voiceNoSR:'Speech recognition unavailable',voiceNoModel:'Model not downloaded',voiceNoHelper:'Speech helper not connected',voiceNoKey:'API key required',voiceNoTrans:'Translation engine not ready',voiceNoVoice:'No voice for target language',holdHint:'hold',noMicrophone:'No microphone detected',liveConversation:'Live conversation',docDropTitle:'Drop a document here',docDropBrowse:'or click to browse',docSummaryTitle:'Translation Summary',subVideoTitle:'Make subtitles from a video or audio file',subVideoComingSoon:'Coming soon',subVideoHelperNote:'Requires the local speech helper desktop app',transMemory:'Translation memory',translatedChip:'Translated',cardSwap:'Swap',noVoiceInstalled:'No voice installed',recentTranslations:'Recent translations',viewAll:'View all',noRecentTranslations:'No recent translations yet.',statusOfflineAvail:'Offline engines available',statusOnlineActive:'Internet engines active',statusNotDownloaded:'not downloaded',statusReady:'ready',statusOllamaReady:'Ollama ready',statusOllamaDown:'Ollama unreachable',
 engines:'Engines & keys',eyebrow:'Text · Subtitles · Documents · Voice',h1a:'One translator,',h1b:'every engine.',
 tabEnginesKeys:'Translation engines & keys',tabVoices:'Voices (reading aloud)',tabVoiceModels:'Voice models (speech recognition)',tabTrModels:'Translation models (offline)',tabOcr:'Screen reading (OCR)',
 tabIdiom:'Idioms',idPh:'Type an idiom or saying…',idFindH:'Find an idiom by its meaning',idFindHint:'Describe what you want to say, for example “someone who talks too much”. Needs an AI engine.',idDescPh:'Describe a meaning…',idFindBtn:'Find idioms',idStored:'Stored idiom',idAiH:'AI explanation',idMeaning:'Meaning',idLiteral:'Literal wording',idEquivalent:'Natural equivalent',idRegister:'Register',idExamples:'Examples',idNotIdiom:'The AI does not think this is an idiom.',idNoAiStored:'No AI engine is available, so only the stored entry is shown.',idNoAiNone:'This is not in the stored idioms, and no AI engine is available to explain it. Add a key in Engines & keys.',idFindNoAi:'Finding idioms by meaning is done by an AI engine, and none is available. Add a key in Engines & keys.',idSave:'Save idiom',idIdiomBadge:'idiom',idAsking:'Asking the AI…',idNoMatch:'No matching idioms found.',idMarkTitle:'Idiom: click for its meaning',tabDict:'Dictionary',dictPh:'Type a word…',dictSearch:'Search',dictVulgar:'Show vulgar words',dictAuto:'Auto (detect language)',dictHidden:'This word is marked as vulgar and hidden. Turn on “Show vulgar words” to see it.',dictHiddenSome:'Some entries are hidden (vulgar). Turn on “Show vulgar words” to see them.',dictGetPack:'Get the dictionary',dictNoPack:'The offline dictionary for this language is not downloaded yet.',dictNotFound:'No entry found for this word.',dictMyWords:'My words',dictExport:'Export CSV',dictClear:'Clear list',dictLocalOnly:'The word list is stored only in this browser.',dictSave:'Save word',dictSaved:'Saved ✓',dictExplain:'Explain with AI',dictExplaining:'Asking the AI…',dictNoAi:'No AI engine is available. Add a key in Engines & keys.',dictPhrases:'Idioms and phrases',dictForms:'Forms',dictAlso:'More meanings (from the other dictionary)',dictFormOf:'form of',dictPackEnFa:'Dictionary · English → Persian · about 1.1 MB',dictPackFaEn:'Dictionary · Persian → English · about 0.9 MB',dictRemove:'Remove',dictPackNote:'The dictionary works without internet once downloaded, also with Offline mode on. Data from Wiktionary (CC BY-SA); see About & credits.',creditsBtn:'About & credits',creditsText:'Offline dictionary: data from Wiktionary (CC BY-SA 4.0 / GFDL), extracted with Wiktextract and distributed by Kaikki.org; entries chosen with the wordfreq ranking by Robyn Speer (CC BY-SA 4.0). The dictionary is shared under the same CC BY-SA licence. Attribution does not imply endorsement. Offline voices: Piper voices from rhasspy/piper-voices (MIT) run with ONNX Runtime Web (MIT) and the eSpeak NG phonemizer (GPL-3.0-or-later; its files are in vendor/piper). The voices Amir, Ganji, LJ Speech, Cori and Kristin are CC0 / public domain; the voice Alba (University of Edinburgh) is CC BY 4.0. Offline translation and speech models come from Hugging Face; each model keeps its own licence (the NLLB-200 models are CC BY-NC 4.0).',dictDownloading:'Downloading…',dictAiAsk:'Explain the word or phrase below for a learner: its usage, its register (formal, neutral, informal or slang) and three short example sentences, each with a translation. Be concise.',tabText:'Text',tabSub:'Subtitle',tabDoc:'Document',tabVoice:'Voice',tabMedia:'Media',tabCmp:'Compare',tabGls:'Glossary',tabHist:'History',
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
 noOfflineModel:'No offline model downloaded',autoModelPrefix:'Auto → ',offTr:'Translation model · NLLB, 200 languages · about 900 MB',offAsr:'Speech model · Whisper (~80 MB WASM / ~155 MB WebGPU)',ready:'ready',notDl:'not downloaded',dlDone:'Download finished. Ready for offline use.',
 needDl:'download it first (Engines & keys → Offline)',needUrl:'needs a URL',needModel:'choose a model',install:'Install',local:'local',offline:'offline',
 engineStateReady:'ready',engineStateNeedsKey:'needs a key',engineStateNotDownloaded:'not downloaded',engineStateOfflineBlocked:'offline mode blocks it',engineStateNotHere:'not supported in this browser',offlineBlocked:'offline mode blocks it',
 enginePickerLabel:'Translate with',enginePickerAuto:'Auto (your order in Settings)',engineUsing:'Using',engineGetModelsKeys:'Get models / keys',engineGetModelsHub:'Get models',engineTestBtn:'Test',engineTesting:'Testing…',engineTestSent:'Hello, how are you?',
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
 vStatusWorking:'Translating…',vStatusStillWorking:'Still translating…',stillTranslating:'Still translating…',vStatusSpeaking:'Speaking translation…',vStatusPreparing:'Preparing voice…',vPreparingPtt:'Preparing…',vPreparingTapStop:'Tap to cancel',vStatusError:'Error',
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
 pdfPassword:'This PDF is password protected. Remove the password first, then open it again.',pdfCorrupt:'This PDF could not be read. It may be damaged.',pdfTooBigPages:'This PDF is too large ({count} pages, limit 1000).',pdfTooBigSize:'This PDF is too large ({size} MB, limit 200 MB).',pdfNoText:'This PDF has no selectable text, so it is probably a scanned document. OCR for PDF files is not available yet.',pdfReadingProgress:'Reading PDF… page {n} of {m}',pdfSummary:'PDF: {pages} pages, {paras} paragraphs, about {words} words. Layout is rebuilt as paragraphs and may differ from the original.',
 docSubject:'Subject & Domain',docSubjectAuto:'Auto (detect from document)',docRegister:'Register',docRegNeutral:'Neutral / Standard',docRegTechnical:'Technical / Specialized',docRegFormal:'Formal / Academic',docRegCasual:'Casual / Colloquial',
 docKeyTerms:'Key Terminology',docAddTerm:'+ Add term',docAddToGlossary:'+ Add to Glossary',docTermsSaved:'Terms added to Glossary',docAnalyzing:'Analyzing document subject & key terms…',
 docReviewTerms:'Review in context',docReviewing:'Reviewing detected terms in context…',docReviewDone:'Terminology reviewed: {n} corrected/verified.',
 docKeepLayout:'Keep page layout',
 docNotes:'Translator notes',docNotesDesc:'Attach footnotes or slide notes for ambiguous terms & context',docEstSize:'Estimated size',
 docSegments:'segments',docWords:'words',docPagesEst:'pages',docSlidesEst:'slides',docRowsEst:'rows',
 docEngineNoticeText:'Subject analysis & translator notes require an AI engine. Full document translation, file structure, formatting, tables, and Glossary work completely with non-AI engines (such as Google Translate, MyMemory, and offline NLLB).',
 docChangeEngine:'Change in Settings',
 dTranslateWith:'Translate with',docSameAsText:'Same as Text tab',docStatusReady:'Ready',docNeedsKey:'Needs key',docNeedsOllamaRunning:'Needs Ollama running',docNeedsModelDownload:'Needs model download',docOffInSettings:'Off in Engines & keys',docTagOffline:'Offline',docTagOnline:'Online',docStartOllamaPrompt:'Ollama is not running. Start Ollama, then try again.',docDownloadModelPrompt:'Download the offline model in Engines & keys.',docAddKeyPrompt:'Add a {engine} key in Engines & keys.',docTurnedOffPrompt:'{engine} is turned off. Turn it on in Engines & keys.',docChromeNotAvailablePrompt:'Chrome on-device translator is not available in this browser.',docCustomUrlPrompt:'Add a server URL in Engines & keys.',docInternetRequiredPrompt:'{engine} requires an internet connection. Turn off Offline mode or connect to the internet.',docOllamaModelNotFound:'Model {model} is not downloaded. Run “ollama pull {model}” or select a model in Engines & keys.',docTriedPrefix:'Tried: ',docTriedSuffix:'. Choose an engine under Translate with, or open Engines & keys.',docNotAvailableHere:'not available here',docTurnedOffInSettings:'turned off in Engines & keys',docModelNotDownloaded:'model not downloaded',docOllamaNotRunning:'Ollama not running',docDidNotAnswer:'did not answer',docDidNotAnswerInTime:'did not answer in time',docRateLimitReached:'rate limit reached',docNetworkError:'network error',docOfflineModeActive:'offline mode active',docTransFailed:'Translation failed.',waitingForOllama:'Waiting for Ollama…',ollamaFirstLoadNote:'(the first answer can take a minute while the model loads)',ollamaTimeoutHint:'Ollama did not answer within {sec} seconds. Try a smaller model or wait for the model to load.',
 loadingOfflineModel:'Loading offline model…',
 offlineOom:'The offline model{model} ran out of memory and was restarted. A browser tab has a memory limit lower than the computer\'s RAM. Try again, or choose a smaller model.',
 heavyModelHint:'This model requires several GB of free memory. A smaller model is more reliable on devices with limited RAM.',
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
 wizardSkip:'Skip',wizardStep1Title:'Choose your language',wizardStep1Sub:'Select the primary language for the interface and default translations.',wizardLangFaDesc:'Persian user interface (RTL)',wizardBadgeRec:'Recommended',wizardLangEnDesc:'English user interface',wizardStep2Title:'Choose your translation engine',wizardStep2Sub:'Choose how translations are processed with complete privacy transparency.',wizardEngineOnlineTitle:'Fast',wizardEngineOnlineDesc:'Quick free online translation via Google and MyMemory; text is sent to the cloud provider.',wizardBadgeOnline:'Online',wizardEngineSmartTitle:'Smart',wizardEngineOllamaDesc:'AI translation via Gemini, Groq, OpenRouter (using your key) or local models via Ollama.',wizardBadgeSmart:'AI Engine',wizardEngineOfflineTitle:'Offline',wizardEngineOfflineDesc:'In-browser translation with NLLB; runs locally inside your browser after the model is downloaded.',wizardBadgeOffline:'Offline',wizardKeySectionTitle:'Optional AI key',wizardKeySectionSub:'Gemini, Groq, OpenRouter',wizardKeySectionDesc:'Optionally add a free API key for Smart translation. Keys are saved strictly in this browser.',wizardKeyInputPh:'Enter API key here (optional)',wizardKeySaved:'✓ Saved',wizardStep3Title:'Download offline models (optional)',wizardStep3Sub:'Download translation and speech models now, or later from Model Hub.',wizardPkgSkipTitle:'Skip download for now',wizardPkgSkipDesc:'Keep setup fast. Download offline models anytime from the Model Hub.',wizardPkgSkipBadge:'Instant',wizardPkgLightTitle:'NLLB-200 600M offline translation',wizardPkgLightDesc:'NLLB-200 translation model for 200 languages (~870 MB).',wizardPkgFullTitle:'Full package: Translation & Speech',wizardPkgFullDesc:'Translation (NLLB ~870 MB) + Speech recognition (Whisper Small ~240 MB) (~1.1 GB).',wizardStatusTitle:'Voice & screen status',wizardVoiceStatusLbl:'Voice & speech:',wizardScreenStatusLbl:'Screen Translator:',wizardVoiceReady:'Ready ✓',wizardVoiceLimited:'Limited',wizardVoiceNotReady:'Not ready',wizardScreenDesktop:'Connected to desktop ✓',wizardScreenBrowser:'Web browser',wizardStepHowTitle:'How it works',wizardStepHowSub:'A quick guide to core features, data privacy, and settings.',wizardHowTabsTitle:'Main application tabs',wizardHowTabsDesc:'Text for instant typing, Subtitles for srt/vtt files, Documents for office files, Voice for speech, and Screen for overlay capture.',wizardHowModesTitle:'Fast vs Smart vs Offline',wizardHowModesDesc:'Fast uses free online servers, Smart uses AI engines or Ollama, and Offline runs NLLB locally inside your browser.',wizardHowDataTitle:'Data transmission & privacy',wizardHowDataDesc:'Offline mode runs models directly in your browser once downloaded; online and AI modes send text only to your chosen provider.',wizardHowSettingsTitle:'Settings & reopening this guide',wizardHowSettingsDesc:'Configure engines, keys, voices and models anytime in Settings (⚙️). You can also reopen this guide there.',wizardStep4Title:'You’re all set!',wizardStep4Sub:'MAKAN Translate is configured and ready to use.',wizardStep5Title:'You’re all set!',wizardStep5Sub:'MAKAN Translate is configured and ready to use.',wizardSumLangLbl:'Interface language:',wizardSumEngineLbl:'Translation engine:',wizardSumPrivacyLbl:'Privacy:',wizardSumKeyLbl:'AI key:',wizardSumPkgLbl:'Offline package:',wizardSumStatusLbl:'Voice & screen:',wizardGoTextBtn:'Go to Text translation →',continue:'Continue',back:'Back',getStarted:'Get Started',openWizardBtn:'Welcome wizard',
 tabEnginesKeys:'Translation engines & keys',tabVoices:'Voices (reading aloud)',tabVoiceModels:'Voice models (speech recognition)',tabTrModels:'Translation models (offline)',tabOcr:'Screen reading (OCR)',tabDict:'Dictionary',tabAppearance:'Appearance',themeH:'Color Theme',themeNote:'Choose from 7 crafted themes. Changes apply instantly.'
},fa:{
 engines:'موتورها و کلیدها',eyebrow:'متن · زیرنویس · سند · صدا',h1a:'یک مترجم،',h1b:'همه‌ی موتورها.',
 tabIdiom:'اصطلاحات',idPh:'یک اصطلاح یا ضرب‌المثل بنویسید…',idFindH:'پیدا کردن اصطلاح از روی معنی',idFindHint:'آنچه می‌خواهید بگویید را توصیف کنید، مثلاً «کسی که زیاد حرف می‌زند». به موتور هوش مصنوعی نیاز دارد.',idDescPh:'یک معنی را توصیف کنید…',idFindBtn:'پیدا کردن اصطلاح',idStored:'اصطلاح ذخیره‌شده',idAiH:'توضیح هوش مصنوعی',idMeaning:'معنی',idLiteral:'معنی تحت‌اللفظی',idEquivalent:'معادل طبیعی',idRegister:'سطح زبان',idExamples:'مثال‌ها',idNotIdiom:'هوش مصنوعی این را اصطلاح نمی‌داند.',idNoAiStored:'موتور هوش مصنوعی در دسترس نیست؛ فقط مدخل ذخیره‌شده نمایش داده می‌شود.',idNoAiNone:'این اصطلاح در فهرست ذخیره‌شده نیست و موتور هوش مصنوعی هم برای توضیح در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',idFindNoAi:'پیدا کردن اصطلاح از روی معنی با موتور هوش مصنوعی انجام می‌شود و هیچ موتوری در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',idSave:'ذخیره‌ی اصطلاح',idIdiomBadge:'اصطلاح',idAsking:'در حال پرسیدن از هوش مصنوعی…',idNoMatch:'اصطلاح مناسبی پیدا نشد.',idMarkTitle:'اصطلاح: برای دیدن معنی کلیک کنید',tabDict:'فرهنگ لغت',dictPh:'یک واژه بنویسید…',dictSearch:'جستجو',dictVulgar:'نمایش واژه‌های رکیک',dictAuto:'خودکار (تشخیص زبان)',dictHidden:'این واژه رکیک علامت خورده و پنهان است. برای دیدن آن «نمایش واژه‌های رکیک» را روشن کنید.',dictHiddenSome:'برخی مدخل‌ها (رکیک) پنهان هستند. برای دیدن آن‌ها «نمایش واژه‌های رکیک» را روشن کنید.',dictGetPack:'دریافت فرهنگ لغت',dictNoPack:'فرهنگ لغت آفلاین این زبان هنوز دانلود نشده است.',dictNotFound:'برای این واژه مدخلی پیدا نشد.',dictMyWords:'واژه‌های من',dictExport:'خروجی CSV',dictClear:'پاک کردن فهرست',dictLocalOnly:'فهرست واژه‌ها فقط در همین مرورگر ذخیره می‌شود.',dictSave:'ذخیره‌ی واژه',dictSaved:'ذخیره شد ✓',dictExplain:'توضیح با هوش مصنوعی',dictExplaining:'در حال پرسیدن از هوش مصنوعی…',dictNoAi:'موتور هوش مصنوعی در دسترس نیست. در «موتورها و کلیدها» کلید وارد کنید.',dictPhrases:'اصطلاحات و عبارت‌ها',dictForms:'شکل‌ها',dictAlso:'معنی‌های بیشتر (از فرهنگ لغت دیگر)',dictFormOf:'شکلی از',dictPackEnFa:'فرهنگ لغت · انگلیسی ← فارسی · حدود ۱٫۱ مگابایت',dictPackFaEn:'فرهنگ لغت · فارسی ← انگلیسی · حدود ۰٫۹ مگابایت',dictRemove:'حذف',dictPackNote:'فرهنگ لغت پس از دانلود بدون اینترنت کار می‌کند، حتی با حالت آفلاین. داده‌ها از ویکی‌واژه (CC BY-SA)؛ «درباره و منابع» را ببینید.',creditsBtn:'درباره و منابع',creditsText:'فرهنگ لغت آفلاین: داده‌ها از ویکی‌واژه (CC BY-SA 4.0 / GFDL) با Wiktextract و Kaikki.org؛ انتخاب مدخل‌ها با رتبه‌بندی wordfreq از Robyn Speer (CC BY-SA 4.0). این فرهنگ لغت با همان مجوز CC BY-SA منتشر می‌شود. ذکر منبع به معنای تأیید نیست. صداهای آفلاین: صداهای Piper از rhasspy/piper-voices (MIT) با ONNX Runtime Web (MIT) و واج‌نگار eSpeak NG (GPL-3.0-or-later؛ فایل‌هایش در vendor/piper است). صداهای امیر، گنجی، ال‌جی اسپیچ، کوری و کریستین با مجوز CC0 / مالکیت عمومی و صدای آلبا (دانشگاه ادینبرا) CC BY 4.0 است. مدل‌های ترجمه و گفتار آفلاین از Hugging Face می‌آیند و هر مدل مجوز خودش را دارد (مدل‌های NLLB-200 با مجوز CC BY-NC 4.0 هستند).',dictDownloading:'در حال دانلود…',dictAiAsk:'واژه یا عبارت زیر را برای زبان‌آموز توضیح بده: کاربرد، سطح رسمی بودن (رسمی، خنثی، محاوره‌ای یا عامیانه) و سه جمله‌ی مثال کوتاه همراه با ترجمه. مختصر باش.',tabText:'متن',tabSub:'زیرنویس',tabDoc:'سند',tabVoice:'صدا',tabMedia:'رسانه',tabCmp:'مقایسه',tabGls:'واژه‌نامه',tabHist:'تاریخچه',
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
 noOfflineModel:'هیچ مدل آفلاینی دانلود نشده است',autoModelPrefix:'خودکار ← ',offTr:'مدل ترجمه · NLLB، ۲۰۰ زبان · حدود ۹۰۰ مگابایت',offAsr:'مدل گفتار · Whisper (حدود ۸۰ مگابایت WASM / حدود ۱۵۵ مگابایت WebGPU)',ready:'آماده',notDl:'دانلود نشده',dlDone:'دانلود تمام شد. آماده‌ی استفاده‌ی آفلاین.',
 needDl:'ابتدا دانلود کنید (موتورها و کلیدها ← آفلاین)',needUrl:'نشانی لازم دارد',needModel:'یک مدل انتخاب کنید',install:'نصب',local:'محلی',offline:'آفلاین',
 engineStateReady:'آماده',engineStateNeedsKey:'کلید لازم دارد',engineStateNotDownloaded:'دانلود نشده',engineStateOfflineBlocked:'حالت آفلاین مانع آن است',engineStateNotHere:'در این مرورگر پشتیبانی نمی‌شود',offlineBlocked:'حالت آفلاین مانع آن است',
 enginePickerLabel:'ترجمه با',enginePickerAuto:'خودکار (ترتیب شما در تنظیمات)',engineUsing:'در حال استفاده',engineGetModelsKeys:'دریافت مدل‌ها / کلیدها',engineGetModelsHub:'دریافت مدل‌ها',engineTestBtn:'آزمایش',engineTesting:'در حال آزمایش…',engineTestSent:'Hello, how are you?',
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
 vStatusWorking:'در حال ترجمه…',vStatusStillWorking:'همچنان در حال ترجمه…',stillTranslating:'همچنان در حال ترجمه…',vStatusSpeaking:'در حال خواندن ترجمه…',vStatusPreparing:'در حال آماده‌سازی صدا…',vPreparingPtt:'در حال آماده‌سازی…',vPreparingTapStop:'برای لغو ضربه بزنید',vStatusError:'خطا',
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
 pdfPassword:'این فایل PDF دارای رمز عبور است. ابتدا رمز را حذف کرده و دوباره امتحان کنید.',pdfCorrupt:'این فایل PDF قابل خواندن نبود. ممکن است آسیب دیده باشد.',pdfTooBigPages:'این فایل PDF بیش از حد بزرگ است ({count} صفحه، حد مجاز ۱۰۰۰ صفحه).',pdfTooBigSize:'حجم این فایل PDF بیش از حد مجاز است ({size} مگابایت، حد مجاز ۲۰۰ مگابایت).',pdfNoText:'این فایل PDF متن قابل انتخابی ندارد و احتمالاً یک سند اسکن‌شده است. OCR برای فایل‌های PDF هنوز در دسترس نیست.',pdfReadingProgress:'در حال خواندن PDF… صفحه {n} از {m}',pdfSummary:'PDF: {pages} صفحه، {paras} پاراگراف، حدود {words} کلمه. ساختار متن به صورت پاراگراف بازسازی شده و ممکن است با چیدمان سند اصلی تفاوت داشته باشد.',
 docSubject:'موضوع و حوزه تخصصی',docSubjectAuto:'خودکار (تشخیص از روی سند)',docRegister:'لحن و سیاق متن',docRegNeutral:'معمولی / استاندارد',docRegTechnical:'فنی / تخصصی',docRegFormal:'رسمی / دانشگاهی',docRegCasual:'محاوره‌ای / عامیانه',
 docKeyTerms:'واژگان و اصطلاحات کلیدی',docAddTerm:'+ افزودن واژه',docAddToGlossary:'+ افزودن به واژه‌نامه',docTermsSaved:'واژگان به واژه‌نامه اضافه شدند',docAnalyzing:'در حال تحلیل موضوع و اصطلاحات کلیدی سند…',
 docReviewTerms:'بررسی در متن',docReviewing:'در حال بررسی اصطلاحات در بافت متن…',docReviewDone:'بررسی اصطلاحات انجام شد: {n} مورد بازبینی شد.',
 docKeepLayout:'حفظ چینش صفحات',
 docNotes:'یادداشت‌های مترجم',docNotesDesc:'افزودن پانویس یا یادداشت اسلاید برای اصطلاحات تخصصی و نکات فرهنگی',docEstSize:'حجم تخمینی',
 docSegments:'بخش',docWords:'کلمه',docPagesEst:'صفحه',docSlidesEst:'اسلاید',docRowsEst:'سطر',
 docEngineNoticeText:'تحلیل موضوع و یادداشت‌های مترجم به موتور هوش مصنوعی نیاز دارند. ترجمه کامل متن سند، ساختار فایل، قالب‌بندی، جدول‌ها و واژه‌نامه با تمام موتورهای غیر هوش مصنوعی (مانند <bdi>Google Translate</bdi>، <bdi>MyMemory</bdi> و مدل آفلاین <bdi>NLLB</bdi>) کاملاً فعال است.',
 docChangeEngine:'تغییر در تنظیمات',
 dTranslateWith:'ترجمه با',docSameAsText:'همانند برگه متن',docStatusReady:'آماده',docNeedsKey:'نیاز به کلید',docNeedsOllamaRunning:'نیاز به اجرای Ollama',docNeedsModelDownload:'نیاز به دانلود مدل',docOffInSettings:'خاموش در موتورها و کلیدها',docTagOffline:'آفلاین',docTagOnline:'آنلاین',docStartOllamaPrompt:'Ollama در حال اجرا نیست. ابتدا Ollama را اجرا کنید، سپس دوباره امتحان کنید.',docDownloadModelPrompt:'مدل آفلاین را در موتورها و کلیدها دانلود کنید.',docAddKeyPrompt:'کلید {engine} را در موتورها و کلیدها وارد کنید.',docTurnedOffPrompt:'{engine} خاموش است. آن را در موتورها و کلیدها روشن کنید.',docEngineTurnedOffPrompt:'{engine} خاموش است. آن را در موتورها و کلیدها روشن کنید.',docChromeNotAvailablePrompt:'مترجم داخلی کروم در این مرورگر پشتیبانی نمی‌شود.',docCustomUrlPrompt:'نشانی سرور را در موتورها و کلیدها وارد کنید.',docInternetRequiredPrompt:'{engine} نیاز به اتصال اینترنت دارد. حالت آفلاین را خاموش کنید یا به اینترنت متصل شوید.',docOllamaModelNotFound:'مدل {model} دانلود نشده است. دستور «ollama pull {model}» را اجرا کنید یا در موتورها و کلیدها یک مدل انتخاب کنید.',docTriedPrefix:'موتورهای امتحان‌شده: ',docTriedSuffix:'. یک موتور در «ترجمه با» انتخاب کنید یا «موتورها و کلیدها» را باز کنید.',docNotAvailableHere:'در این مرورگر در دسترس نیست',docTurnedOffInSettings:'خاموش در موتورها و کلیدها',docModelNotDownloaded:'مدل دانلود نشده',docOllamaNotRunning:'Ollama در حال اجرا نیست',docDidNotAnswer:'پاسخی نداد',docDidNotAnswerInTime:'به‌موقع پاسخی نداد',docRateLimitReached:'محدودیت درخواست',docNetworkError:'خطای شبکه',docOfflineModeActive:'حالت آفلاین فعال است',docTransFailed:'ترجمه ناموفق بود.',waitingForOllama:'در حال انتظار برای Ollama…',ollamaFirstLoadNote:'(پاسخ اول ممکن است در حین بارگذاری مدل یک دقیقه طول بکشد)',ollamaTimeoutHint:'Ollama در مدت {sec} ثانیه پاسخی نداد. یک مدل کوچک‌تر را امتحان کنید یا منتظر بارگذاری مدل بمانید.',
 loadingOfflineModel:'در حال بارگذاری مدل آفلاین…',
 offlineOom:'مدل آفلاین با کمبود حافظه مواجه شد و راه‌اندازی مجدد گردید. دوباره تلاش کنید یا یک مدل کوچک‌تر انتخاب کنید.',
 heavyModelHint:'این مدل به چندین گیگابایت حافظه رم آزاد نیاز دارد. مدلی کوچک‌تر روی دستگاه‌هایی با حافظه محدود مطمئن‌تر است.',
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
 offTrModel:'Offline translation model',offWhisperModel:'Offline speech model',autoMdl:'Auto',usedByAuto:'Used by Auto',
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
 helperDesktopOnlyNotice:'Python ASR Helper requires running the local helper server (127.0.0.1:8765) or the MAKAN Windows desktop app.',
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
 testScreenTransBtn:'Capture Screen Region Now',
 reportBug:'Report a bug',bugReportTitle:'Report a bug',bugWhatHappened:'What happened?',bugWhatExpected:'What did you expect?',bugDiagTitle:'Included diagnostics (read-only):',bugSendEmail:'Send by email',bugCopyReport:'Copy report',bugCopied:'Copied to clipboard ✓',bugCopyFallback:'Could not copy automatically; please copy from the preview.',bugTruncated:'[Diagnostics truncated to fit email client limit]',aboutVersion:'Version {v}',mediaAsrEnglishOnly:'This model is English only.',mediaSwitchTurbo:'Switch to Turbo',
 helpGuideTitle:'What it can do, limits, and what computer you need',
 helpGuideHtml:`<p>Complete capability reference, hardware guide, and operational limits for MAKAN Translate.</p>
<h4>1. Capability &amp; Limits by Tab</h4>
<ul>
  <li><strong>Text:</strong> Instant translation across 99+ languages with AI fallback. Large texts batched. Works offline with NLLB/M2M or Ollama.</li>
  <li><strong>Subtitle:</strong> Translates .srt and .vtt files preserving millisecond timestamps. Text format only (up to 10 MB).</li>
  <li><strong>Document:</strong> Translates Word (.docx), PowerPoint (.pptx), Excel (.xlsx), PDF, Markdown, CSV, JSON. Up to 25 MB. Scanned image PDFs need OCR.</li>
  <li><strong>Voice:</strong> Real-time microphone translation and voice read-aloud. Supports hands-free live conversation mode. Offline with Whisper &amp; Piper.</li>
  <li><strong>Screen:</strong> Configures OCR language and reading mode. <em>Experimental in browser:</em> native screen capture requires the Windows desktop app.</li>
  <li><strong>Media:</strong> Transcribes audio and video (.mp3, .mp4, .wav), generates subtitles, and customizes styles. In-browser memory limits apply to long files (over 30–40 min); long files and MKV/AVI need the Windows app with ffmpeg.</li>
  <li><strong>Dictionary:</strong> Offline Wiktionary lookup (CC BY-SA), normalized search, and vocabulary export.</li>
  <li><strong>Idioms:</strong> Curated idiom database works offline; generative reverse lookup needs an AI key or local Ollama.</li>
  <li><strong>Compare:</strong> Translates side-by-side across multiple engines simultaneously.</li>
  <li><strong>Glossary:</strong> Custom replacement rules enforced across all translations.</li>
  <li><strong>History:</strong> Stores recent translations locally with search and CSV export.</li>
  <li><strong>Games:</strong> <em>Experimental:</em> Interactive vocabulary flashcards and drills based on your saved words.</li>
  <li><strong>Model Hub:</strong> Inspect, download, and manage on-device Whisper, NLLB, M2M, OPUS, and Piper models.</li>
</ul>
<h4>2. Which setup should I choose?</h4>
<div style="overflow-x:auto">
<table class="help-table" style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px">
  <thead>
    <tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:start;padding:6px">Setup</th>
      <th style="text-align:start;padding:6px">Speech Model</th>
      <th style="text-align:start;padding:6px">Translation Model / Engine</th>
      <th style="text-align:start;padding:6px">Download Size</th>
      <th style="text-align:start;padding:6px">What to Avoid</th>
      <th style="text-align:start;padding:6px">Trade-Off</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:6px"><strong>Weak Laptop</strong><br>(4 GB RAM, no GPU)</td>
      <td style="padding:6px"><strong>Whisper Tiny</strong><br>(42 MB download, 1000 MB RAM)</td>
      <td style="padding:6px"><strong>OPUS-MT EN → AR</strong><br>(112 MB download, 1000 MB RAM) or Cloud engines</td>
      <td style="padding:6px">~154 MB</td>
      <td style="padding:6px">Avoid <strong>NLLB-200 600M (default)</strong> (870 MB download, 4.1 GB RAM), <strong>mBART-50 many-to-many</strong> (848 MB download, 3.4 GB RAM), and <strong>Whisper Large v3 Turbo</strong> (1.0 GB download, 3.3 GB RAM).</td>
      <td style="padding:6px">Whisper Tiny is fast but weak in Persian. Small OPUS-MT language pairs are light but only exist for the pairs in the catalog. Online engines need almost no hardware but send text using your key.</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:6px"><strong>Normal Laptop</strong><br>(8 GB RAM)</td>
      <td style="padding:6px"><strong>Whisper Small</strong><br>(240 MB download, 3.2 GB RAM) or <strong>Whisper Base</strong><br>(76 MB download, 1.4 GB RAM)</td>
      <td style="padding:6px"><strong>NLLB-200 600M (default)</strong><br>(870 MB download, 4.1 GB RAM) or <strong>M2M-100 418M</strong><br>(610 MB download, 2.1 GB RAM)</td>
      <td style="padding:6px">~1.1 GB</td>
      <td style="padding:6px">Avoid running Whisper Large and NLLB simultaneously without closing other tabs.</td>
      <td style="padding:6px">Whisper Small is the first size handling Persian, Arabic and Turkish properly. NLLB-200 needs several GB of RAM.</td>
    </tr>
    <tr>
      <td style="padding:6px"><strong>Strong PC</strong><br>(16 GB+ RAM / WebGPU)</td>
      <td style="padding:6px"><strong>Whisper Large v3</strong> (most accurate, needs about 3 GB download on the graphics card path, slower than Turbo on the processor), <strong>Whisper Large v3 Turbo</strong><br>(1.0 GB download, 3.3 GB RAM) or <strong>Whisper Small</strong></td>
      <td style="padding:6px"><strong>NLLB-200 600M (default)</strong><br>(870 MB download, 4.1 GB RAM) or local Ollama</td>
      <td style="padding:6px">~1.9 GB</td>
      <td style="padding:6px">None.</td>
      <td style="padding:6px">Whisper Large v3 Turbo provides top accuracy; tries the graphics card first and falls back to the processor when WebGPU is not available.</td>
    </tr>
  </tbody>
</table>
</div>
<h4>3. Minimum &amp; Recommended Hardware</h4>
<ul>
  <li><strong>Minimum:</strong> 4 GB RAM · 500 MB free disk space · Modern browser (Chrome 115+, Edge 115+, Firefox 115+) · WebGPU optional · Speed: speed not measured yet · Measured on: Not measured yet: the Media tab shows how long each run took</li>
  <li><strong>Recommended:</strong> 8 GB – 16 GB+ RAM · 3 GB – 5 GB free disk space · Chrome/Edge with WebGPU enabled · Speed: speed not measured yet · Measured on: Not measured yet: the Media tab shows how long each run took</li>
</ul>
<h4>4. How to Use &amp; Tips for Weak Systems</h4>
<p>Downloads from the Model Hub are saved into browser storage (transformers-cache) once and remain available offline. In the Media tab, long audio files are decoded in browser RAM; keep clips under 30–40 min on 8 GB systems. On weak systems, close other background tabs and apps, choose small models (Whisper Tiny / OPUS-MT), or use cloud engines.</p>
<h4>5. Web Version vs Windows App vs Extension</h4>
<ul>
  <li><strong>Screen Translator:</strong> Windows app only (native OCR). Web app configuration only.</li>
  <li><strong>Python Speech Helper:</strong> Available on Windows app or local helper server (127.0.0.1:8765).</li>
  <li><strong>ffmpeg Support:</strong> Windows app only (handles MKV/AVI and unlimited video length).</li>
  <li><strong>Open in App:</strong> Triggered from extension, received by Web App or Desktop App.</li>
  <li><strong>Offline Models:</strong> Available in Web App and Windows App via browser cache storage.</li>
</ul>
<h4>6. Operational Limits &amp; Transparency</h4>
<p>Unofficial Google web endpoints may stop working or be rate-limited without warning. Local Ollama on a hosted HTTPS page requires OLLAMA_ORIGINS="https://makanlab.tech" and browser permission. The Windows desktop app is self-built and not code-signed (SmartScreen prompt on first launch).</p>
<h4>7. Bug Reports &amp; Support</h4>
<p>If you encounter an issue, use the <strong>Report a bug</strong> button in the Help or About window. Nothing is sent automatically by the app. Your own default email program sends the message, allowing you to inspect and edit every word before sending. You can also copy the report to your clipboard.</p>
<p><strong>Support email:</strong> makan20042002@gmail.com</p>
<p><strong>What the report contains:</strong> app version, interface language, operating system and browser version, active tab, translation mode, names of enabled translation engines, offline mode status, names of downloaded offline models, WebGPU availability, whether running in the Windows app, and up to the last 5 error messages (with any keys, tokens, or queries redacted).</p>
<p><strong>What the report NEVER contains:</strong> API keys or authorization tokens, custom server URLs, your source or translated text, file names or paths, and translation history.</p>
<h4>8. Choosing the translation engine</h4>
<p>In the Text, Subtitle, Document and Media tabs, you can select between <strong>Auto</strong> (tries your configured engine chain from Settings with silent fallback on failure) or <strong>a specific engine</strong> (translates only with that engine, displaying plain error reasons without fallback). When an engine has multiple models, a <strong>Model</strong> selector appears next to it (API models, Ollama/custom models, or downloaded offline models). Each engine displays its status: <em>ready</em>, <em>needs a key</em>, <em>not downloaded</em>, or <em>offline mode blocks it</em>. The Media tab also includes a <strong>Speech model</strong> selector for downloaded Whisper sizes. After completing, the Media and Subtitle tabs report the exact elapsed time (e.g. <em>Done in 12 s</em>). Chrome on-device translation is not supported in the Windows desktop app (Electron) and is honestly omitted from the auto chain. Click <strong>Test</strong> to translate a sample sentence with your chosen engine to verify connectivity and measure latency without affecting your history.</p>
<h4>9. Where each engine works</h4>
<div class="table-scroll-wrap" style="overflow-x:auto;max-width:100%;margin:10px 0;">
<table class="help-table engine-matrix-table" style="width:100%;border-collapse:collapse;font-size:12px;margin:4px 0;">
  <thead>
    <tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:start;padding:6px;color:var(--text)">Engine</th>
      <th style="text-align:center;padding:6px;color:var(--text)">Web app in Chrome</th>
      <th style="text-align:center;padding:6px;color:var(--text)">Web app in Edge</th>
      <th style="text-align:center;padding:6px;color:var(--text)">Web app in Firefox or Safari</th>
      <th style="text-align:center;padding:6px;color:var(--text)">Windows app</th>
      <th style="text-align:center;padding:6px;color:var(--text)">Extension</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="gemini">
      <td style="padding:6px;color:var(--text)"><strong>Gemini</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="openrouter">
      <td style="padding:6px;color:var(--text)"><strong>OpenRouter</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="mistral">
      <td style="padding:6px;color:var(--text)"><strong>Mistral</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="cerebras">
      <td style="padding:6px;color:var(--text)"><strong>Cerebras</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="openai">
      <td style="padding:6px;color:var(--text)"><strong>OpenAI</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="claude">
      <td style="padding:6px;color:var(--text)"><strong>Claude</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">needs key</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">needs key</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="ollama">
      <td style="padding:6px;color:var(--text)"><strong>Ollama</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs OLLAMA_ORIGINS">needs OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs OLLAMA_ORIGINS">needs OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs OLLAMA_ORIGINS">needs OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">yes</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="custom">
      <td style="padding:6px;color:var(--text)"><strong>LM Studio / custom</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">yes</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="chrome">
      <td style="padding:6px;color:var(--text)"><strong>Chrome on-device</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="not verified">not verified</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="no">no</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="no">no</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">no</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="google">
      <td style="padding:6px;color:var(--text)"><strong>Google web</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">yes</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="mymemory">
      <td style="padding:6px;color:var(--text)"><strong>MyMemory</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">yes</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">yes</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="nllb">
      <td style="padding:6px;color:var(--text)"><strong>NLLB / M2M / mBART / OPUS-MT offline</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">no</td>
    </tr>
    <tr data-engine="whisper">
      <td style="padding:6px;color:var(--text)"><strong>Whisper</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="firefox" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs download">needs download</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">no</td>
    </tr>
  </tbody>
</table>
</div>`
});
Object.assign(I18N.fa,{
 tabEnginesKeys:'موتورهای ترجمه و کلیدها',tabVoices:'صداها (خواندن با صدای بلند)',tabVoiceModels:'مدل‌های صوتی (تشخیص گفتار)',tabTrModels:'مدل‌های ترجمه (آفلاین)',tabOcr:'خوانش تصویر و صفحه (OCR)',tabAppearance:'ظاهر و تم',themeH:'تم رنگی',themeNote:'از بین ۷ تم طراحی‌شده انتخاب کنید. تغییرات فوراً اعمال می‌شوند.',
 mdlGrpListen:'شنیدن · گفتار به متن (Whisper)',mdlGrpTr:'ترجمه',mdlGrpSpeak:'گفتن · متن به گفتار',
 mdlPairs:'مدل‌های کوچک تک‌جفتی: سریع و سبک، ولی فقط برای همان جفت زبانی که نامشان نشان می‌دهد.',mdlPairsPrefer:'اگر برای این جفت زبان مدل کوچک دانلود شده، از آن استفاده کن (سریع‌تر، معمولاً با کیفیت کمتر)',
 mdlSize:'دانلود',mdlMem:'حافظه',mdlGpu:'WebGPU',mdlLangs:'زبان‌ها',mdlGpuNo:'لازم نیست',mdlGpuOpt:'اختیاری، اگر مرورگر داشته باشد سریع‌تر است (توسط توسعه‌دهنده آزمایش نشده)',
 mdlSizeTip:'حجم فایل‌هایی که این مرورگر دانلود می‌کند، از صفحه‌ی مدل در Hugging Face.',mdlMemTip:'بیشترین حافظه‌ی مصرفی در اجرای این مدل روی یک رایانه‌ی آزمایشی ۴ هسته‌ای. رایانه‌ی شما ممکن است کمی بیشتر یا کمتر مصرف کند.',
 mdlRecNonEn:'برای زبان‌های غیر از انگلیسی توصیه می‌شود',mdlWeak:'بیشتر برای انگلیسی؛ در زبان‌های دیگر ضعیف',
 mdlDelete:'حذف',mdlUse:'استفاده',mdlInUse:'در حال استفاده',mdlDeleted:'از این مرورگر حذف شد',mdlDownloading:'در حال دانلود…',
 fgOpt:'فینگلیش · فارسی با حروف لاتین',fgSpelling:'املای فارسی',fgNeedsAi:'فینگلیش (فارسی با حروف لاتین) به یک موتور هوش مصنوعی نیاز دارد. در «موتورها و کلیدها» یک کلید رایگان Gemini یا Groq اضافه کنید.',fgVia:'فینگلیش ← فارسی',
 mdlOfflineVoice:'صدای آفلاین',mdlSpeed:'سرعت',mdlSpeedUnit:'ثانیه انتظار برای هر ثانیه گفتار (رایانه‌ی آزمایشی، بدون WebGPU)',mdlEngineOnce:'موتور گفتار، یک بار',offlineVoicesGrp:'صداهای آفلاین (دانلودشده)',noVoiceOffline:'یا در «موتورها و کلیدها ← آفلاین» یک صدای آفلاین دانلود کنید.',
 mdlTotal:'فضای اشغال‌شده در این دستگاه توسط این مدل‌ها',mdlSiteTotal:'کل داده‌های این سایت',vTranscribing:'در حال تبدیل گفتار به متن…',
 offTrModel:'مدل ترجمه‌ی آفلاین',offWhisperModel:'مدل گفتار آفلاین',autoMdl:'خودکار',usedByAuto:'استفاده در حالت خودکار',
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
 helperDesktopOnlyNotice:'دستیار گفتار پایتون نیاز به اجرای سرور کمکی محلی (127.0.0.1:8765) یا برنامه ویندوز MAKAN دارد.',
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
wizardSkip:'بعداً',wizardStep1Title:'زبان خود را انتخاب کنید',wizardStep1Sub:'زبان اصلی برای رابط کاربری و ترجمه‌های پیش‌فرض را مشخص کنید.',wizardLangFaDesc:'رابط کاربری فارسی و راست‌به‌چپ',wizardBadgeRec:'پیشنهادی',wizardLangEnDesc:'رابط کاربری انگلیسی',wizardStep2Title:'روش ترجمه: سریع، هوشمند یا آفلاین',wizardStep2Sub:'روش پردازش ترجمه‌ها را با شفافیت کامل درباره حریم خصوصی و خروج داده انتخاب کنید.',wizardEngineOnlineTitle:'سریع',wizardEngineOnlineDesc:'ترجمه آنلاین پرسرعت و رایگان با گوگل و <bdi>MyMemory</bdi>؛ متن برای ترجمه به ارائه‌دهنده ابری ارسال می‌شود.',wizardBadgeOnline:'آنلاین',wizardEngineSmartTitle:'هوشمند',wizardEngineOllamaDesc:'ترجمه هوش مصنوعی با <bdi>Gemini</bdi>، <bdi>Groq</bdi> یا <bdi>OpenRouter</bdi> (با کلید شما) یا اجرای مدل‌های محلی با <bdi>Ollama</bdi>.',wizardBadgeSmart:'هوش مصنوعی',wizardEngineOfflineTitle:'آفلاین',wizardEngineOfflineDesc:'ترجمه درون مرورگر با مدل <bdi>NLLB</bdi>؛ پس از دریافت بسته مدل، پردازش محلی در مرورگر اجرا می‌شود.',wizardBadgeOffline:'آفلاین',wizardKeySectionTitle:'کلید هوش مصنوعی (اختیاری)',wizardKeySectionSub:'Gemini, Groq, OpenRouter',wizardKeySectionDesc:'برای ترجمه هوشمند می‌توانید یک کلید رایگان اضافه کنید. کلید تنها در همین مرورگر ذخیره شده و به هیچ سرور دیگری ارسال نمی‌شود.',wizardKeyInputPh:'کلید API را اینجا وارد کنید (اختیاری)',wizardKeySaved:'✓ ذخیره شد',wizardStep3Title:'دانلود مدل‌های آفلاین (اختیاری)',wizardStep3Sub:'دریافت مدل‌های ترجمه و گفتار برای استفاده کاملاً آفلاین اکنون، یا بعداً از مرکز مدل‌ها.',wizardPkgSkipTitle:'فعلاً بدون دانلود',wizardPkgSkipDesc:'راه‌اندازی فوری بدون دانلود؛ مدل‌های آفلاین را هر زمان می‌توانید از بخش تنظیمات دریافت کنید.',wizardPkgSkipBadge:'فوری',wizardPkgLightTitle:'مدل ترجمه آفلاین <bdi>NLLB-200 600M</bdi>',wizardPkgLightDesc:'مدل ترجمه <bdi>NLLB-200</bdi> برای ۲۰۰ زبان (حدود ۸۷۰ مگابایت) از فهرست رسمی.',wizardPkgFullTitle:'بسته کامل: ترجمه و گفتار',wizardPkgFullDesc:'ترجمه <bdi>NLLB</bdi> (حدود ۸۷۰ مگابایت) و تشخیص گفتار <bdi>Whisper Small</bdi> (حدود ۲۴۰ مگابایت) (مجموعاً حدود ۱٫۱ گیگابایت).',wizardStatusTitle:'وضعیت صدا و صفحه نمایش',wizardVoiceStatusLbl:'صدا و گفتار:',wizardScreenStatusLbl:'مترجم صفحه نمایش:',wizardVoiceReady:'آماده ✓',wizardVoiceLimited:'محدود',wizardVoiceNotReady:'آماده نیست',wizardScreenDesktop:'متصل به دسکتاپ ✓',wizardScreenBrowser:'محیط مرورگر وب',wizardStepHowTitle:'راهنمای کارکرد برنامه',wizardStepHowSub:'آشنایی کوتاه با بخش‌های اصلی، جریان داده‌ها و نحوه تنظیمات.',wizardHowTabsTitle:'بخش‌های اصلی برنامه',wizardHowTabsDesc:'متن برای ترجمه فوری، زیرنویس برای فایل‌های <bdi>srt</bdi> و <bdi>vtt</bdi>، اسناد برای فایل‌های اداری، صدا برای مکالمه، و صفحه برای ترجمه تصویر.',wizardHowModesTitle:'سریع در برابر هوشمند و آفلاین',wizardHowModesDesc:'سریع از سرورهای رایگان آنلاین استفاده می‌کند، هوشمند با هوش مصنوعی یا <bdi>Ollama</bdi> کار می‌کند، و آفلاین با <bdi>NLLB</bdi> در مرورگر اجرا می‌شود.',wizardHowDataTitle:'مسیر انتقال داده‌ها و حریم خصوصی',wizardHowDataDesc:'حالت آفلاین مدل‌ها را پس از دانلود درون مرورگر اجرا می‌کند؛ حالت‌های آنلاین و هوش مصنوعی متن را فقط به ارائه‌دهنده انتخابی شما ارسال می‌کنند.',wizardHowSettingsTitle:'تنظیمات و دسترسی مجدد',wizardHowSettingsDesc:'تمام گزینه‌ها، کلیدها و دانلود مدل‌ها در بخش تنظیمات در دسترس است؛ این راهنما را نیز هرزمان می‌توانید از تنظیمات مجدداً باز کنید.',wizardStep4Title:'همه‌چیز آماده است!',wizardStep4Sub:'مترجم ماکان پیکربندی شد و آماده ترجمه متن‌های شماست.',wizardStep5Title:'همه‌چیز آماده است!',wizardStep5Sub:'مترجم ماکان پیکربندی شد و آماده ترجمه متن‌های شماست.',wizardSumLangLbl:'زبان رابط کاربری:',wizardSumEngineLbl:'روش ترجمه:',wizardSumPrivacyLbl:'حریم خصوصی:',wizardSumKeyLbl:'کلید هوش مصنوعی:',wizardSumPkgLbl:'بسته آفلاین:',wizardSumStatusLbl:'صدا و صفحه:',wizardGoTextBtn:'ورود به بخش ترجمه متن →',continue:'ادامه',back:'بازگشت',getStarted:'شروع استفاده',openWizardBtn:'راهنمای راه‌اندازی',reportBug:'گزارش باگ',bugReportTitle:'گزارش مشکل',bugWhatHappened:'چه اتفاقی افتاد؟',bugWhatExpected:'انتظار داشتید چه بشود؟',bugDiagTitle:'اطلاعات تشخیصی پیوست‌شده (فقط خواندنی):',bugSendEmail:'ارسال با ایمیل',bugCopyReport:'کپی گزارش',bugCopied:'در کلیپ‌بورد کپی شد ✓',bugCopyFallback:'کپی خودکار انجام نشد؛ لطفاً از کادر پیش‌نمایش کپی کنید.',bugTruncated:'[اطلاعات تشخیصی برای گنجایش در ایمیل کوتاه شد]',aboutVersion:'نسخه {v}',mediaAsrEnglishOnly:'این مدل فقط برای زبان انگلیسی است.',mediaSwitchTurbo:'تغییر به مدل Turbo',
helpGuideTitle:'قابلیت‌ها، محدودیت‌ها و سخت‌افزار مورد نیاز',
helpGuideHtml:`<p>راهنمای جامع قابلیت‌ها، نیازمندی‌های سخت‌افزاری و محدودیت‌های کاری مترجم ماکان.</p>
<h4>۱. قابلیت‌ها و محدودیت‌ها در هر بخش</h4>
<ul>
  <li><strong>متن (Text):</strong> ترجمه بلادرنگ بیش از ۹۹ زبان با زنجیره پشتیبان هوش مصنوعی. متن‌های طولانی به صورت دسته‌ای ارسال می‌شوند. کاملاً آفلاین با NLLB یا M2M و Ollama.</li>
  <li><strong>زیرنویس (Subtitle):</strong> ترجمه فایل‌های srt و vtt با حفظ دقیق زمان‌بندی میلی‌ثانیه‌ای تا سقف ۱۰ مگابایت.</li>
  <li><strong>اسناد (Document):</strong> ترجمه اسناد ورد، پاورپوینت، اکسل، PDF، مارک‌داون، CSV و JSON با حفظ قالب‌بندی. فایل‌های تصویری اسکن‌شده نیاز به OCR دارند.</li>
  <li><strong>صدا (Voice):</strong> تشخیص گفتار زنده با میکروفون و خواندن صوتی ترجمه. حالت مکالمه زنده دوطرفه. عملکرد آفلاین با مدل‌های Whisper و صداهای Piper.</li>
  <li><strong>صفحه (Screen):</strong> تنظیمات زبان و موتور نویسه‌خوان. <em>در مرورگر آزمایشی است:</em> تصویربرداری مستقیم از صفحه به برنامه ویندوز MAKAN نیاز دارد.</li>
  <li><strong>رسانه (Media):</strong> پیاده‌سازی متن فایل‌های صوتی و تصویری (mp3, mp4, wav)، ساخت زیرنویس و سفارشی‌سازی سبک. فایل‌های طولانی (بیش از ۳۰ تا ۴۰ دقیقه) در مرورگر به حافظه زیادی نیاز دارند و فرمت‌های MKV/AVI نیاز به برنامه ویندوز با ffmpeg دارند.</li>
  <li><strong>فرهنگ لغت (Dictionary):</strong> جستجوی سریع کلمات از داده‌های ویکی‌واژه (CC BY-SA)، ذخیره واژه‌های من و خروجی CSV کاملاً آفلاین.</li>
  <li><strong>اصطلاحات (Idioms):</strong> بانک اصطلاحات آفلاین؛ جستجوی معکوس معنایی نیاز به کلید هوش مصنوعی دارد.</li>
  <li><strong>مقایسه (Compare):</strong> مقایسه همزمان نتایج چند موتور ترجمه کنار یکدیگر.</li>
  <li><strong>واژه‌نامه (Glossary):</strong> تعریف کلمات اختصاصی و اعمال همگانی در تمام ترجمه‌ها.</li>
  <li><strong>تاریخچه (History):</strong> ثبت محلی ترجمه‌های اخیر در مرورگر با قابلیت جستجو و خروجی CSV.</li>
  <li><strong>بازی‌ها (Games):</strong> <em>آزمایشی:</em> تمرین واژگان و فلش‌کارت بر پایه لغات ذخیره‌شده.</li>
  <li><strong>مرکز مدل‌ها (Model Hub):</strong> مشاهده، دانلود و مدیریت مدل‌های Whisper، NLLB، M2M، OPUS و صداهای Piper در حافظه مرورگر.</li>
</ul>
<h4>۲. کدام پیکربندی برای رایانه من مناسب است؟</h4>
<div style="overflow-x:auto">
<table class="help-table" style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px">
  <thead>
    <tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:start;padding:6px">سیستم</th>
      <th style="text-align:start;padding:6px">مدل گفتار پیشنهادی</th>
      <th style="text-align:start;padding:6px">مدل یا موتور ترجمه پیشنهادی</th>
      <th style="text-align:start;padding:6px">حجم دانلود</th>
      <th style="text-align:start;padding:6px">موارد پرهیز</th>
      <th style="text-align:start;padding:6px">مزایا و محدودیت‌ها</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:6px"><strong>لپ‌تاپ ضعیف</strong><br>(۴ گیگابایت رم، بدون کارت گرافیک)</td>
      <td style="padding:6px"><strong>Whisper Tiny</strong><br>(42 MB دانلود، 1000 MB رم)</td>
      <td style="padding:6px"><strong>OPUS-MT EN → AR</strong><br>(112 MB دانلود، 1000 MB رم) یا موتورهای ابری</td>
      <td style="padding:6px">حدود 154 MB</td>
      <td style="padding:6px">پرهیز از <strong>NLLB-200 600M (default)</strong> (حجم 870 MB، رم 4.1 GB)، <strong>mBART-50 many-to-many</strong> (حجم 848 MB، رم 3.4 GB) و <strong>Whisper Large v3 Turbo</strong> (حجم 1.0 GB، رم 3.3 GB).</td>
      <td style="padding:6px">مدل Whisper Tiny سریع است اما در فارسی ضعیف است. مدل‌های OPUS-MT فقط برای جفت‌های موجود در کاتالوگ هستند. موتورهای آنلاین به سخت‌افزار نیازی ندارند اما متن را با کلید شما ارسال می‌کنند.</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)">
      <td style="padding:6px"><strong>لپ‌تاپ معمولی</strong><br>(۸ گیگابایت رم)</td>
      <td style="padding:6px"><strong>Whisper Small</strong><br>(240 MB دانلود، 3.2 GB رم) یا <strong>Whisper Base</strong><br>(76 MB دانلود، 1.4 GB رم)</td>
      <td style="padding:6px"><strong>NLLB-200 600M (default)</strong><br>(870 MB دانلود، 4.1 GB رم) یا <strong>M2M-100 418M</strong><br>(610 MB دانلود، 2.1 GB رم)</td>
      <td style="padding:6px">حدود 1.1 GB</td>
      <td style="padding:6px">پرهیز از اجرای همزمان Whisper Large و NLLB بدون بستن تب‌های سنگین مرورگر.</td>
      <td style="padding:6px">مدل Whisper Small اولین اندازه‌ای است که فارسی، عربی و ترکی را به درستی تشخیص می‌دهد. NLLB-200 به چند گیگابایت رم نیاز دارد.</td>
    </tr>
    <tr>
      <td style="padding:6px"><strong>رایانه قدرتمند</strong><br>(۱۶ گیگابایت رم به بالا / WebGPU)</td>
      <td style="padding:6px"><strong>Whisper Large v3</strong> (دقیق‌ترین، در مسیر کارت گرافیک به حدود ۳ گیگابایت دانلود نیاز دارد، روی پردازنده کندتر از Turbo است)، <strong>Whisper Large v3 Turbo</strong><br>(1.0 GB دانلود، 3.3 GB رم) یا <strong>Whisper Small</strong></td>
      <td style="padding:6px"><strong>NLLB-200 600M (default)</strong><br>(870 MB دانلود، 4.1 GB رم) یا Ollama محلی</td>
      <td style="padding:6px">حدود 1.9 GB</td>
      <td style="padding:6px">بدون محدودیت خاص.</td>
      <td style="padding:6px">مدل Whisper Large v3 Turbo بالاترین دقت را فراهم می‌کند؛ ابتدا از کارت گرافیک استفاده می‌کند و در صورت عدم پشتیبانی WebGPU به پردازنده برمی‌گردد.</td>
    </tr>
  </tbody>
</table>
</div>
<h4>۳. حداقل و سخت‌افزار پیشنهادی</h4>
<ul>
  <li><strong>حداقل سخت‌افزار:</strong> ۴ گیگابایت رم · ۵۰۰ مگابایت فضای خالی دیسک · مرورگرهای مدرن (Chrome 115+, Edge 115+, Firefox 115+) · پشتیبانی از WebGPU اختیاری · سرعت: speed not measured yet · خط ثبت: Measured on: Not measured yet: the Media tab shows how long each run took</li>
  <li><strong>سخت‌افزار پیشنهادی:</strong> ۸ تا ۱۶ گیگابایت رم به بالا · ۳ تا ۵ گیگابایت فضای دیسک · کروم یا اج با قابلیت WebGPU · پشتیبانی از WebGPU شدیداً توصیه می‌شود · سرعت: speed not measured yet · خط ثبت: Measured on: Not measured yet: the Media tab shows how long each run took</li>
</ul>
<h4>۴. نحوه استفاده و نکاتی برای سیستم‌های ضعیف</h4>
<p>مدل‌ها از مرکز مدل‌ها یک‌بار در حافظه مرورگر دانلود شده و برای همیشه آفلاین می‌مانند. در بخش رسانه، فایل‌های صوتی به طور کامل در رم مرورگر باز می‌شوند؛ برای سیستم‌های ۸ گیگابایتی فایل‌ها را زیر ۳۰ تا ۴۰ دقیقه نگه دارید. در سیستم‌های ضعیف‌تر، تب‌ها و برنامه‌های اضافی را ببندید، کلیپ‌های کوتاه ارسال کنید، یا از مدل‌های سبک (مانند Whisper Tiny یا OPUS-MT) و موتورهای ابری استفاده نمایید.</p>
<h4>۵. نسخه وب در برابر برنامه ویندوز و افزونه</h4>
<ul>
  <li><strong>مترجم صفحه (Screen):</strong> فقط برنامه ویندوز با OCR داخلی. نسخه وب فقط پیکربندی است.</li>
  <li><strong>دستیار گفتار پایتون:</strong> در برنامه ویندوز یا با سرور کمکی محلی (127.0.0.1:8765).</li>
  <li><strong>پشتیبانی از ffmpeg:</strong> فقط در برنامه ویندوز برای فایل‌های MKV/AVI و ویدئوهای بسیار طولانی.</li>
  <li><strong>باز کردن در برنامه (Open in App):</strong> فعال‌سازی از افزونه به مقصد برنامه وب یا ویندوز.</li>
  <li><strong>مدل‌های آفلاین:</strong> در نسخه وب و برنامه ویندوز از طریق حافظه ماندگار مرورگر فعال است.</li>
</ul>
<h4>۶. محدودیت‌ها و شفافیت فنی</h4>
<p>نقطه پایانی غیررسمی گوگل ممکن است بدون اطلاع مسدود یا محدود شود. برای Ollama در صفحه وب میزبانی‌شده، تنظیم متغیر OLLAMA_ORIGINS="https://makanlab.tech" و اجازه دسترسی به شبکه محلی در مرورگر ضروری است. برنامه ویندوز بدون امضای دیجیتال تجاری است (هشدار SmartScreen در اولین اجرا ظاهر می‌شود).</p>
<h4>۷. گزارش باگ و پشتیبانی</h4>
<p>در صورت بروز هرگونه مشکل، می‌توانید از دکمه <strong>گزارش باگ</strong> در پنجره راهنما یا درباره استفاده کنید. هیچ داده‌ای به صورت خودکار توسط برنامه ارسال نمی‌شود؛ برنامه ایمیل پیش‌فرض خودِ شما پیام را باز می‌کند تا پیش از ارسال بتوانید تمامی متن را بررسی و ویرایش نمایید. همچنین امکان کپی متن گزارش در کلیپ‌بورد فراهم است.</p>
<p><strong>ایمیل پشتیبانی:</strong> makan20042002@gmail.com</p>
<p><strong>اطلاعات موجود در گزارش:</strong> نسخه برنامه، زبان رابط کاربری، سیستم‌عامل و نسخه مرورگر، تب فعال، حالت ترجمه، نام موتورهای فعال، وضعیت حالت آفلاین، نام مدل‌های آفلاین دانلودشده، وضعیت WebGPU، مشخص بودن اجرا در برنامه ویندوز، و حداکثر ۵ خطای اخیر رخ‌داده (با سانسور کامل هرگونه کلید، توکن یا آدرس سرور).</p>
<p><strong>اطلاعاتی که هرگز ارسال نمی‌شوند:</strong> کلیدهای API یا توکن‌های امنیتی، آدرس سرورهای سفارشی، متن مبدأ یا ترجمه‌شده شما، نام و مسیر فایل‌ها، و تاریخچه ترجمه‌ها.</p>
<h4>۸. انتخاب موتور ترجمه</h4>
<p>در تب‌های متن، اسناد، زیرنویس و رسانه می‌توانید بین <strong>خودکار (Auto)</strong> (بررسی موتورها به ترتیب تنظیمات شما با جایگزینی خودکار در صورت خطا) یا <strong>یک موتور خاص</strong> (ترجمه فقط با همان موتور و نمایش مستقیم علت خطا بدون تغییر خودکار) انتخاب کنید. در صورت وجود چند مدل برای یک موتور، یک انتخابگر <strong>مدل</strong> در کنار آن ظاهر می‌شود (مدل‌های ابری، مدل‌های Ollama و سرورهای سفارشی، یا مدل‌های آفلاین دانلودشده). هر موتور وضعیت خود را نشان می‌دهد: <em>آماده</em>، <em>کلید لازم دارد</em>، <em>دانلود نشده</em>، یا <em>حالت آفلاین مانع آن است</em>. در کارت تبدیل گفتار بخش رسانه نیز یک انتخابگر <strong>مدل گفتار</strong> برای اندازه‌های دانلودشده Whisper وجود دارد. پس از اتمام کار، تب‌های رسانه و زیرنویس زمان سپری‌شده دقیق را گزارش می‌کنند (مانند <em>انجام شد در 12 ثانیه</em>). مترجم روی دستگاه کروم در برنامه ویندوز (Electron) پشتیبانی نمی‌شود و صادقانه از زنجیره خودکار حذف می‌گردد. با زدن دکمه <strong>آزمایش</strong> می‌توانید یک جمله نمونه را بدون تغییر تاریخچه آزمایش کرده و زمان پاسخ‌دهی را مشاهده نمایید.</p>
<h4>۹. جدول سازگاری موتورهای ترجمه</h4>
<p>راهنمای دسترسی به هر موتور در محیط‌های مختلف کاربری. ارزش‌ها مستقیماً بر اساس قوانین واقعی سیستم تعیین شده‌اند.</p>
<div class="table-scroll-wrap" style="overflow-x:auto;max-width:100%;margin:8px 0;-webkit-overflow-scrolling:touch">
<table class="help-table" style="width:100%;border-collapse:collapse;font-size:12px;min-width:540px;color:var(--text)">
  <thead>
    <tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:start;padding:6px">موتور</th>
      <th style="text-align:center;padding:6px">وب در Chrome</th>
      <th style="text-align:center;padding:6px">وب در Edge</th>
      <th style="text-align:center;padding:6px">وب در Firefox / Safari</th>
      <th style="text-align:center;padding:6px">برنامه ویندوز</th>
      <th style="text-align:center;padding:6px">افزونه مرورگر</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="gemini">
      <td style="padding:6px"><strong>Gemini</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="openrouter">
      <td style="padding:6px"><strong>OpenRouter</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="mistral">
      <td style="padding:6px"><strong>Mistral</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="cerebras">
      <td style="padding:6px"><strong>Cerebras</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="openai">
      <td style="padding:6px"><strong>OpenAI</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="claude">
      <td style="padding:6px"><strong>Claude</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs key">نیاز به کلید (needs key)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="needs key">نیاز به کلید (needs key)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="ollama">
      <td style="padding:6px"><strong>Ollama</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs OLLAMA_ORIGINS">نیاز به OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs OLLAMA_ORIGINS">نیاز به OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs OLLAMA_ORIGINS">نیاز به OLLAMA_ORIGINS</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">بله (yes)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="custom">
      <td style="padding:6px"><strong>LM Studio / سرور سفارشی</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">بله (yes)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="chrome">
      <td style="padding:6px"><strong>Chrome روی دستگاه (Translator API)</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="not verified">تأیید نشده (not verified)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="no">خیر (no)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="no">خیر (no)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">خیر (no)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="google">
      <td style="padding:6px"><strong>Google وب</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">بله (yes)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="mymemory">
      <td style="padding:6px"><strong>MyMemory</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="yes">بله (yes)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="yes">بله (yes)</td>
    </tr>
    <tr style="border-bottom:1px solid var(--border2)" data-engine="nllb">
      <td style="padding:6px"><strong>مدل‌های محلی NLLB / M2M / mBART / OPUS-MT</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">خیر (no)</td>
    </tr>
    <tr data-engine="whisper">
      <td style="padding:6px"><strong>Whisper (تشخیص گفتار)</strong></td>
      <td style="padding:6px;text-align:center" data-col="chrome" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="edge" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="other-browsers" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="windows" data-value="needs download">نیاز به دانلود (needs download)</td>
      <td style="padding:6px;text-align:center" data-col="ext" data-value="no">خیر (no)</td>
    </tr>
  </tbody>
</table>
</div>`
});
const ensureMediaI18n = () => {
  if (typeof window !== 'undefined' && window.MediaTranslate && window.MediaTranslate.i18n) {
    if (window.MediaTranslate.i18n.en) Object.assign(I18N.en, window.MediaTranslate.i18n.en);
    if (window.MediaTranslate.i18n.fa) Object.assign(I18N.fa, window.MediaTranslate.i18n.fa);
  }
};
ensureMediaI18n();
let ui=store.get('ui','en');
const L=k=>I18N[ui][k]??I18N.en[k]??k;
function applyI18n(){
  ensureMediaI18n();
  document.documentElement.lang=ui;document.documentElement.dir=ui==='fa'?'rtl':'ltr';
  document.querySelectorAll('[data-t]').forEach(e=>{const v=L(e.dataset.t);if(v.includes('<'))e.innerHTML=v;else e.textContent=v;});
  document.querySelectorAll('[data-tp]').forEach(e=>e.placeholder=L(e.dataset.tp));
  $('uiLang').textContent=ui==='fa'?'English':'فارسی';
  var aboutVerEl = $('aboutVersion');
  if (aboutVerEl) {
    var verStr = (typeof ENG !== 'undefined' && typeof ENG.getAppVersion === 'function') ? ENG.getAppVersion() : '1.0.0';
    aboutVerEl.textContent = L('aboutVersion').replace('{v}', verStr);
  }
  if(typeof updateCardLangNames==='function')updateCardLangNames();
  if(typeof updateTextCounts==='function')updateTextCounts();
  if(typeof renderRecentTranslations==='function')renderRecentTranslations();
  if(typeof renderTextStatusStrip==='function')renderTextStatusStrip();
  if(typeof updateVoiceReadiness==='function')updateVoiceReadiness();
  if(typeof updateAllUnifiedPickers==='function')updateAllUnifiedPickers();
  if(typeof updateDocEngineInfo==='function')updateDocEngineInfo();
  if(typeof window !== 'undefined' && typeof window.MediaTranslate?.onLanguageChange === 'function') window.MediaTranslate.onLanguageChange();
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
  if(!code||code==='auto')return {fa:'تشخیص خودکار',en:'Detect language'};
  if(code==='finglish')return {fa:'فینگلیش',en:'Finglish'};
  const pair=LANGS.find(l=>l[0]===code);
  if(pair&&pair[1].includes(' · ')){
    const parts=pair[1].split(' · ');
    return {fa:parts[0],en:parts[1]};
  }
  return {fa:code||'تشخیص خودکار',en:code||'Detect language'};
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

  if(typeof detectFinglish==='function'&&detectFinglish(trimmed)?.finglish){
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

  const clean=trimmed.toLowerCase().replace(/[^a-zà-ÿ\s]/g,' ');
  const words=clean.trim().split(/\s+/).filter(Boolean);
  if(!words.length)return null;

  const lower=' '+clean+' ';

  if(/[äöüß]/.test(trimmed)||/\b(und|der|die|das|nicht|ist|ein|eine|mit|auf|für|von|sie|wir|aber|auch|guten|morgen|willkommen)\b/.test(lower)){
    return 'de';
  }

  if(/[éèêëàâôûùç]/.test(trimmed)||/\b(le|la|les|des|est|une|dans|pour|avec|sur|sont|que|qui|pas|plus|ce|cette|bonjour|tout|monde)\b/.test(lower)){
    return 'fr';
  }

  if(/[ñáíóú¿¡]/.test(trimmed)||/\b(el|los|las|una|para|como|pero|con|por|este|esta|que|del|mas|hola)\b/.test(lower)){
    return 'es';
  }

  if(/[ğışİI]/.test(trimmed)||/\b(bir|ve|bu|için|olan|ile|da|de|çok|ama|var|yok|gibi)\b/.test(lower)){
    return 'tr';
  }

  if(/\b(non|sono|della|delle|questo|anche|con|per|gli|dei|nel|nella)\b/.test(lower)){
    return 'it';
  }

  const englishWords=/\b(the|is|and|of|in|to|it|you|that|was|for|on|are|as|with|they|at|be|this|from|have|or|by|one|had|not|but|what|all|were|when|we|there|can|an|your|which|their|if|do|will|each|about|how|up|out|them|then|she|many|some|so|these|would|other|into|has|more|her|two|like|him|see|time|no|make|than|first|been|its|who|now|my|over|down|only|way|find|use|water|long|little|very|after|words|just|where|most|know|hello|world|good|morning|hi|please|thank|thanks|welcome|name|book|car|house|water|food|cat|dog|test|help|yes|ok)\b/;
  if(englishWords.test(lower)){
    return 'en';
  }

  if(words.length>=6){
    const validLatinWords=words.every(w=>/^[a-z]{1,20}$/.test(w));
    if(validLatinWords){
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
    if(sel.id==='vAskLang')role='ask';
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
      if(role==='ask'||options.labelKey==='vAskLang'||sel.id==='vAskLang'){
        lbl.setAttribute('data-t','vAskLang');
        lbl.innerHTML=L('vAskLang')||'Answer language';
      }else if(role==='src'){
        lbl.setAttribute('data-t','from');
        lbl.innerHTML=L('from');
      }else if(role==='tgt'){
        lbl.setAttribute('data-t','to');
        lbl.innerHTML=L('to');
      }else if(options.labelKey){
        lbl.setAttribute('data-t',options.labelKey);
        lbl.innerHTML=L(options.labelKey)||options.label||'';
      }else{
        lbl.textContent=options.label||'';
      }
      topLine.appendChild(lbl);

      if(role==='src'&&!options.noDetected){
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
        const r=options.role||'src';
        if(r==='src'){
          if(lbl)lbl.innerHTML=L('from');
        }else if(r==='ask'||options.labelKey==='vAskLang'){
          if(lbl)lbl.innerHTML=L('vAskLang')||'Answer language';
        }else if(options.labelKey){
          if(lbl)lbl.innerHTML=L(options.labelKey)||options.label||'';
        }
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

  srcWrapped=wrapSelect(srcSelect,options.role||'src');
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
