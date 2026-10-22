# I Built MAKAN Translate with AI. The Hardest Part Wasn't Writing Code.

**Subtitle:** Four development approaches, dozens of model experiments, one abandoned game translator, and the engineering lessons behind a free multilingual application.

**Makan · Founder, MAKAN LAB · October 2026**  
**Type:** Independent engineering case study / reflective technical report  
**Project:** https://makanlab.tech/translate/ · **Source:** https://github.com/makan20042002/translator

> **At a glance.** MAKAN Translate began as an attempt to help a friend study Linux with translated Udemy subtitles. I tried visual app generation, coding agents, commercial and local models, and multiple testing strategies. An approximately ten-day intensive development period produced a substantial project—but not a perfect translator. The essential lesson was not how to write a magic prompt. It was how to break work into verifiable pieces and recognize which problems AI could not solve for me.

## Abstract

AI-assisted programming can rapidly produce application interfaces and executable code, but producing maintainable software requires additional work: feasibility research, component integration, model evaluation, regression testing, and decisions about scope. This practitioner case study examines the development of MAKAN Translate, a free multi-engine translator conceived in response to subtitle-translation limits encountered while studying Linux with a friend. It reconstructs four development approaches involving Google AI Studio, ChatGPT/Codex, Claude Code, and Antigravity; describes the eventual division of research, review, coding, and manual verification across tools; and analyzes difficulties with Persian document processing, speech recognition, model compatibility, and game localization. The account is based on the developer's recollections and publicly available project documentation, not a controlled comparison of AI products. Its central finding is qualitative: **task decomposition and validation proved more consequential to the developer's progress than increasingly elaborate prompts or the selection of a single coding assistant.** The paper concludes with a reproducible process for small-scale AI-assisted software engineering and an explicit accounting of its limitations.

**Keywords:** AI-assisted software development; human–AI collaboration; incremental development; software verification; multilingual machine translation; Persian; local language models; open source.

---

## 1. The problem was a friend who wanted to learn Linux

MAKAN Translate did not start with a business plan. It started with a friend.

We were learning Linux through a Udemy course. I could follow the English instruction, but my friend had difficulty understanding it. He wanted to learn with us, and the missing piece seemed simple: translate the course subtitles so he could concentrate on the technical concepts rather than struggle with the language.

I tried general-purpose AI assistants. They could translate a passage, sometimes very well. But an educational course is not a passage. It contains many subtitle files and repeated terminology, and translating two or three files could consume the free allowance. Then the work stopped until usage became available again. Translation quality also varied between languages. I wanted a tool that could finish a job rather than ask me to come back tomorrow.

The same frustration reappeared with PDF documents, especially when working with Persian. Existing services did not always preserve content and formatting well, and their usage limits were still present. I do **not** claim that my own PDF translator has solved this problem; some of those issues remain unresolved.

I had already developed software, including Epsilon Download Manager, and was studying artificial intelligence. So I asked a question that gradually became a project: *Could I build a free translator that offers multiple engines instead of forcing users to depend on one limited service?*

The first version was modest—an interface connected to a translation API. It demonstrated that I could request a translation from code, but it also inherited the API's limits and errors. I had confused a successful API call with a reliable application. That distinction would return throughout the project.

## 2. Four approaches, and why none was a magic solution

### Attempt one: a beautiful interface without the complete application

My first major experiment was Google AI Studio. Its promise—turn an idea into an application—was exciting. The result looked impressive. Screens, controls, and layout appeared quickly. But when I tried to use the features for real work, too much was incomplete or unreliable. I saw similar outcomes in other experiments. The visual result had arrived before the underlying product.

A convincing interface is evidence of design generation, not evidence of functioning software.

### Attempt two: runnable code, then an endless repair loop

I moved to ChatGPT and tried Codex. The first executable application genuinely impressed me. Unlike a mock interface, parts of this code ran. But as I asked for more, the difference between *the AI says it implemented the feature* and *the feature meets my requirements* grew wider.

I would report a failure, receive an apology and a proposed fix, and find another problem. My available tokens ran out without the result I had expected. The failure was not that the model could never write code; it was that I had asked one system to interpret a large vision, design it, implement it, and judge its own success.

### Attempt three: a stronger assistant did not remove cost

Next I tried Claude Code, including approximately $100 in promotional credit. In my recollection, it was consumed within about half a day and the application was still far from ready. This is a personal account of my particular workflow, not a benchmark of Claude Code's price or efficiency for other users.

I was learning another uncomfortable lesson: tool activity, token consumption, and lines of generated code do not measure delivered product value.

### Attempt four: effective code generation, weak alignment with intent

Antigravity offered a usage model I found more workable for longer sessions. It could write a great deal of code, but it sometimes spent hours implementing something other than what I actually wanted. After repeated corrections I made progress, but the pace of usable progress was much slower than the quantity of code suggested.

Eventually I stopped searching for one AI that would do everything. I changed the workflow instead.

## 3. The turning point was a division of labor

I began using ChatGPT for research, explanations, and comparing approaches; Perplexity when its free allowance was available; Claude as a technical mentor and debugging reviewer; and Antigravity principally to implement code. I remained responsible for product decisions, actual use, and acceptance of the result.

This arrangement was not a formal multi-agent framework. It was a practical human-managed division of responsibilities. It reduced the risk of treating the same AI as both author and sole evaluator. More importantly, it forced me to articulate what a feature should do before asking someone—or something—to implement it.

My working sequence became:

1. Identify a concrete user problem rather than request a whole product.
2. Investigate models, libraries, hardware needs, usage restrictions, and compatibility.
3. Define a narrow feature with an observable result.
4. Implement that feature with limited changes to working code.
5. Test it in a real workflow, reproduce the failures, and preserve fixes with regression tests where practical.
6. Expand only after the smaller part behaves acceptably.

This resembles decomposition and incremental development, established principles of software engineering. The novelty for me was discovering how crucial they become when a model can generate new code faster than I can validate it.

The first substantial successes were text translation and browser-extension work. They were neither instant nor bug-free. But after repeated revisions, they did real work, and the larger project had somewhere solid to grow.

## 4. Translation is not one technical problem

The application gradually brought together different translation workflows. A text translator, subtitle processor, speech recognizer, document converter, and browser extension may share a language model, but they do not share the same engineering requirements.

### Subtitles: preserving more than the words

Subtitle files contain text and timing structure. For `.srt` and `.vtt` files, a useful implementation must avoid silently dropping entries, shifting timestamps, or damaging the output format. Technical educational subtitles create an additional requirement: Linux commands, paths, flags, and terminology may need to remain unchanged even when the surrounding explanation is translated.

A fluent translation is not automatically a faithful translation. A test that merely checks that the output is nonempty does not establish that it teaches the same command.

### Persian: advertised support versus useful performance

Finding models capable of handling Persian was one of the hardest research tasks. A model card might list a language, yet the installation could fail, local inference could be too expensive, or the translated result could be weak. I downloaded and tested numerous models and experienced errors, compatibility problems, and disappointing outputs.

Meta's NLLB-200 was a promising multilingual option, and I explored general-purpose Gemma and Qwen models as well. Later I found TranslateGemma particularly good in my informal use. That is an account of my experience, **not a controlled ranking**: I did not produce a public fixed dataset, blinded human ratings, consistent inference settings, and statistical comparisons for these models.

TranslateGemma was announced in January 2026 in 4B, 12B, and 27B variants across 55 languages [2]. NLLB-200's research program addressed translation across a much broader set of languages [1]. Neither research result establishes which model is best for my specific Persian subtitles without testing on that workload.

### Audio: recognition and translation are separate failures

When I explored media translation, speech recognition became another research problem. In my experiments, Whisper was the usable model family I settled on, with large-v3 the strongest option I found for my needs. This should not be read as a claim that Whisper is the only available ASR technology or universally the best. Its maintainers explicitly note that performance varies by language and hardware [3].

A typical workflow can fail at multiple points: audio extraction, speech recognition, segmentation, translation, timestamp alignment, and export. Errors early in the pipeline contaminate everything after them. That is why adding a media feature cannot be reduced to adding another translation button.

### Documents: Persian PDF remains unfinished business

PDF was one of my most frustrating features—and still is. Extraction can fail before translation begins. Text ordering, font encodings, tables, and mixed right-to-left/left-to-right content all complicate the process. Scanned PDFs require OCR before text translation is even possible. Rebuilding a readable document after translation is a different task from translating a paragraph.

I tried multiple fixes, but I am not satisfied that the problem has been completely resolved. The current public product page explicitly warns that some Persian PDFs with unusual fonts produce unusable extracted text and that scanned PDFs are not yet supported without OCR [4]. For me, that is not an embarrassing detail to hide. It is part of an accurate engineering report.

## 5. The side project that taught me to stop: game translation

While developing MAKAN Translate, I also began separate media- and game-translation experiments. I eventually integrated media translation work into the larger translator project, but the game translator became a lesson in scope.

I investigated two fundamentally different approaches.

The first would observe a game while it was running, recognize visible text, translate it, and draw an overlay. For the quality I wanted, continually applying large local models could impose unacceptable costs in latency, memory, and computation on an ordinary PC. Narrower OCR-based techniques may be feasible, but my original ambition—a broadly capable real-time translator—was not practical under my constraints.

The second approach extracted dialogue or localization resources, translated the content, and inserted modified resources back into the game. Here I did achieve working results in two games. Ren'Py was an approachable starting point; Unity was more complicated. But success with two games did not imply a general tool for commercial AAA titles.

Game formats, packaging, localization systems, and protection mechanisms differ. Community extractors may be designed for a particular engine version or even one title. Legal permissions and terms also vary: game modifications are not automatically illegal, but neither is every extraction or redistribution permitted. I could not responsibly promise universal support.

So I stopped. This was not proof that game translation cannot be done. It was a decision that the coverage, support burden, uncertainty, and ongoing maintenance exceeded what I could sustain. More AI-generated code was not the answer to a fragmented ecosystem.

## 6. Testing became the bottleneck

Claude helped define automated tests; Antigravity implemented and ran them. The repository publicly documents Playwright-based tests, mock services, and commands for full, web, and extension suites [5]. An earlier project draft reported more than 900 tests and a roughly 21-minute run. **I have not independently reproduced those numbers**, so they are not presented here as verified measurements.

Automated tests were useful, but they did not reliably catch the failures I encountered in ordinary use. Sometimes apparently small changes led to hours of coding and testing. I therefore relied heavily on manual end-to-end checks: use the translator, observe the result, reproduce a bug, report it, and try again.

The hardest part was not always finding a defect; it was communicating it. “It doesn't work” is a real user experience but a weak debugging specification. I learned to describe the input, expected result, observed result, and steps to reproduce it.

Regression was especially frustrating. Sometimes a change fixed one issue and appeared to create several others. As the application expanded, different pieces shared settings and dependencies, and a local fix could damage an unrelated path. Working alone amplified the burden: I was simultaneously developing, researching, debugging, evaluating translation quality, and deciding what should ship.

AI was still enormously helpful. It could interpret error messages, suggest candidate causes, and rewrite code that I would have found much slower to produce alone. But its speed shifted responsibility toward *verification*. The application was growing faster than my capacity to check it.

A more robust evaluation plan would include tests at three levels:

| Level | What it verifies | What it does **not** prove |
| --- | --- | --- |
| Unit and integration tests | Parsing, API behavior, state changes, timestamp preservation | Translation faithfulness or usability |
| Manual workflow tests | Real websites, document layouts, extension behavior, export quality | Coverage of all environments |
| Language-quality evaluation | Adequacy, terminology, omissions, naturalness with human reference judgments | Universal superiority of one model |

Automated passes, manual observations, and model-quality judgments must be reported separately rather than combined into one vague claim that an app “works.”

## 7. The economic paradox of free AI software

I wanted a free tool because subscription and quota limitations were the reason I started the project. Yet nearly every layer could impose a cost: coding assistant credits, hosted inference, model downloads and compute, third-party services, release processes, and platform distribution.

A model being downloadable does not make it cheap to run. A free API tier does not make repeated subtitle translation unlimited. Publishing an MIT-licensed application does not change the licenses attached to third-party models or data. And offline inference removes dependence on paid per-request APIs only when the user has suitable hardware and accepts the performance trade-offs.

This pushed me toward a multi-engine design: online services when appropriate, users' own API keys where supported, and locally run models for people who prefer that route. It is a trade-off rather than a miracle. A free application can increase user choice without making compute free.

I also learned that AI assistants can misunderstand the importance of context. For example, a disposable API key in a temporary experiment might trigger extended discussion as though it were a permanent production secret, even after I explained the scenario. Temporary credentials still need safe handling, but an effective reviewer should distinguish the specific risk and priority rather than repeat generic advice indiscriminately.

## 8. What exists—and what I cannot claim

The public GitHub repository contains a JavaScript-based application structure, browser-extension sources, media and screen-translation components, documentation, and test directories [5]. Its README describes multi-engine text translation, subtitle import/export, document handling, voice features, dictionary tools, and browser integration. These are **documented implementation claims**, not independent measurements of reliability for every configuration.

There is also a publication mismatch that needs correcting: the website's product page still labels several distribution paths as “coming soon,” whereas the repository describes web-app access and release-oriented workflows [4, 5]. Prospective users should rely on actual accessible downloads, release assets, and current installation instructions rather than treat planned distribution as already complete.

My experience supports these limited conclusions:

- I built a substantial working project and learned to use multiple AI systems more effectively.
- My informal trials found useful translation and transcription models, but I have not published a controlled quality benchmark.
- PDF extraction and Persian document preservation remain difficult.
- Some game-translation prototypes worked, but universal game support was outside practical scope.
- Regression, integration, documentation, and independent verification remain ongoing responsibilities.

It does **not** support claims that MAKAN Translate is the world's best translator, that every advertised feature works flawlessly, or that one AI assistant is objectively superior to the others.

## 9. What I would do differently: a practical method

If I started again, I would not open with “Build me a translator.” I would write down the smallest meaningful outcome: load one `.srt` file, translate its text, preserve timestamps, export a valid `.srt`, and inspect it with a real video. Then I would expand.

For independent developers, my advice is:

**Start with feasibility.** Verify model availability, licensing, inference requirements, file formats, external APIs, and likely deployment costs before building around assumptions.

**Write a roadmap, not a giant prompt.** Define independent components and clear acceptance criteria. Good prompts help, but good project boundaries help more.

**Keep AI changes narrow.** Ask for one feature or bug fix at a time, specify what must not be modified, and insist on evidence of what was and was not tested.

**Pair automated tests with real use.** A green test suite cannot substitute for actual documents, browsers, languages, or users.

**Preserve working states.** Version control and regression checks help when a proposed fix creates new defects.

**Know when to cut.** A small reliable feature is better than a broad claim supported only by a prototype.

I often use a metaphor: **AI is not Moses' staff. You cannot point it at the sea and expect the water to divide.** Perhaps these systems will become far more autonomous. But in my 2026 experience, understanding the problem, choosing a feasible approach, and verifying the result remained essential human responsibilities.

## 10. Conclusion: the real lesson was decomposition

MAKAN Translate started because a friend wanted to study Linux without English subtitles becoming a barrier. It grew into an experiment in machine translation, speech recognition, document processing, browser extensions, model economics, and AI-assisted software engineering.

I am happy with what I built—and equally aware of the bugs, missing features, and unverified claims that remain. I learned far more than how to ask a chatbot for code. I learned to treat AI as a powerful but imperfect collaborator, and software as something that must be evaluated in the real world.

The strongest lesson was not prompt engineering. It was an old programming idea that became newly important in the age of AI: **break a difficult problem into smaller problems, solve one, test it, and only then build the next.**

AI may make code generation dramatically faster. It does not remove the need to know what to build, why to build it, or whether it really works.

---

## Methodology and evidence note

This article is a reflective single-developer case study, written with AI editorial assistance based on my account of the project. The sequence of experiments, time/cost recollections, observed model quality, and manual testing difficulties are self-reported; they were not recorded as a controlled study. The public website and GitHub repository were checked on **22 October 2026** for product descriptions, project structure, and development documentation. No independent benchmark, security audit, installation certification, quantitative regression study, or reproduction of the reported test count was performed for this article. AI assistance was used for structuring, drafting, technical fact-checking, and editing; the experiences and judgments described are mine.

## References

[1] NLLB Team et al. (2022). *No Language Left Behind: Scaling Human-Centered Machine Translation.* https://arxiv.org/abs/2207.04672

[2] Google (15 January 2026). *TranslateGemma: A new family of open translation models.* https://blog.google/innovation-and-ai/technology/developers-tools/translategemma/

[3] OpenAI. *Whisper: README and model documentation.* https://github.com/openai/whisper

[4] MAKAN LAB. *MAKAN Translate product page.* https://makanlab.tech/translate/ (accessed 22 October 2026).

[5] Makan. *MAKAN Translate public repository and README.* https://github.com/makan20042002/translator (accessed 22 October 2026).

---

*Author's note: MAKAN Translate is an ongoing independent project. Features, model availability, limitations, and publication status can change after this article's date. Readers should check the current repository and website.*
