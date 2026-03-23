export const generationEnUS = {
  classroom: {
    recentClassrooms: 'Recent',
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: 'days ago',
    slides: 'slides',
    nameCopied: 'Name copied',
    deleteConfirmTitle: 'Delete',
    delete: 'Delete',
  },
  upload: {
    pdfSizeLimit: 'Supports PDF files up to 50MB',
    generateFailed: 'Failed to generate classroom, please try again',
    requirementPlaceholder:
      'Tell me anything you want to learn, e.g.\n"Teach me Python from scratch in 30 minutes"\n"Explain Fourier Transform on the whiteboard"\n"How to play the board game Avalon"',
    requirementRequired: 'Please enter course requirements',
    fileTooLarge: 'File too large. Please select a PDF file smaller than 50MB',
  },
  generation: {
    // Progress steps (used dynamically via activeStep)
    analyzingPdf: 'Analyzing PDF Document',
    analyzingPdfDesc: 'Extracting document structure and content...',
    pdfLoadFailed: 'Failed to load PDF file, please try again',
    pdfParseFailed: 'PDF parsing failed',
    streamNotReadable: 'Unable to read generation stream',
    generatingOutlines: 'Drafting Course Outline',
    generatingOutlinesDesc: 'Structuring the learning path...',
    generatingSlideContent: 'Generating Page Content',
    generatingSlideContentDesc: 'Creating slides, quizzes, and interactive content...',
    generatingActions: 'Generating Teaching Actions',
    generatingActionsDesc: 'Orchestrating narration, spotlights, and interactions...',
    generationComplete: 'Generation complete!',
    generationFailed: 'Generation failed',
    generatingCourse: 'Generating course',
    openingClassroom: 'Opening classroom...',
    outlineReady: 'Course outline generated',
    generatingFirstPage: 'Generating first page...',
    firstPageReady: 'First page ready! Opening classroom...',
    speechFailed: 'Speech generation failed',
    retryScene: 'Retry',
    retryingScene: 'Regenerating...',
    backToHome: 'Back to Home',
    sessionNotFound: 'Session Not Found',
    sessionNotFoundDesc: 'Please fill in course requirements to start the generation process.',
    goBackAndRetry: 'Go Back and Retry',
    classroomReady: 'Your personalized AI learning environment has been generated successfully.',
    aiWorking: 'AI Agents Working...',
    textTruncated: 'Document text is long, using first {n} characters for generation',
    imageTruncated:
      '{total} images found, exceeding the {max} image limit. Extra images will use text descriptions only',
    // Agent generation
    agentGeneration: 'Generating Classroom Roles',
    agentGenerationDesc: 'Generating roles based on course content...',
    agentRevealTitle: 'Your Classroom Roles',
    viewAgents: 'View Roles',
    continue: 'Continue',
    // Outline errors
    outlineRetrying: 'Outline generation issue, retrying...',
    outlineEmptyResponse:
      'Model returned no valid outlines. Please check model configuration and try again',
    outlineGenerateFailed: 'Outline generation failed, please try again later',
    // Web Search
    webSearching: 'Web Search',
    webSearchingDesc: 'Searching the web for up-to-date information',
    webSearchFailed: 'Web search failed',
  },
} as const;

export const generationHiIN = {
  classroom: {
    recentClassrooms: 'हालिया',
    today: 'आज',
    yesterday: 'कल',
    daysAgo: 'दिन पहले',
    slides: 'स्लाइड्स',
    nameCopied: 'नाम कॉपी किया गया',
    deleteConfirmTitle: 'हटाएं',
    delete: 'हटाएं',
  },
  upload: {
    pdfSizeLimit: '50MB तक की PDF फ़ाइलों का समर्थन करता है',
    generateFailed: 'क्लासरूम जनरेट करने में विफल, कृपया पुनः प्रयास करें',
    requirementPlaceholder:
      'मुझे बताएं कि आप क्या सीखना चाहते हैं, उदाहरण के लिए\n"मुझे 30 मिनट में शुरू से पायथन सिखाएं"\n"व्हाइटबोर्ड पर फूरियर ट्रांसफॉर्म समझाएं"\n"बोर्ड गेम एवलॉन कैसे खेलें"',
    requirementRequired: 'कृपया कोर्स की आवश्यकताएं दर्ज करें',
    fileTooLarge: 'फ़ाइल बहुत बड़ी है। कृपया 50MB से छोटी PDF फ़ाइल चुनें',
  },
  generation: {
    // Progress steps (used dynamically via activeStep)
    analyzingPdf: 'PDF दस्तावेज़ का विश्लेषण',
    analyzingPdfDesc: 'दस्तावेज़ की संरचना और सामग्री निकाली जा रही है...',
    generatingOutlines: 'कोर्स की रूपरेखा तैयार की जा रही है',
    generatingOutlinesDesc: 'सीखने के पथ की संरचना की जा रही है...',
    generatingSlideContent: 'पेज कंटेंट जनरेट किया जा रहा है',
    generatingSlideContentDesc: 'स्लाइड्स, क्विज़ और इंटरैक्टिव कंटेंट बनाया जा रहा है...',
    generatingActions: 'शिक्षण क्रियाएं जनरेट की जा रही हैं',
    generatingActionsDesc: 'कथानक, स्पॉटलाइट और इंटरेक्शन का समन्वय किया जा रहा है...',
    generationComplete: 'जनरेशन पूरा हुआ!',
    generationFailed: 'जनरेशन विफल रहा',
    generatingCourse: 'कोर्स जनरेट किया जा रहा है',
    openingClassroom: 'क्लासरूम खुल रहा है...',
    outlineReady: 'कोर्स की रूपरेखा जनरेट हो गई',
    generatingFirstPage: 'पहला पेज जनरेट किया जा रहा है...',
    firstPageReady: 'पहला पेज तैयार है! क्लासरूम खुल रहा है...',
    speechFailed: 'स्पीच जनरेशन विफल रहा',
    retryScene: 'पुनः प्रयास करें',
    retryingScene: 'पुनः जनरेट किया जा रहा है...',
    backToHome: 'होम पर वापस जाएं',
    sessionNotFound: 'सत्र नहीं मिला',
    sessionNotFoundDesc: 'जनरेशन प्रक्रिया शुरू करने के लिए कृपया कोर्स की आवश्यकताएं भरें।',
    goBackAndRetry: 'वापस जाएं और पुनः प्रयास करें',
    classroomReady: 'आपका व्यक्तिगत AI लर्निंग वातावरण सफलतापूर्वक जनरेट हो गया है।',
    aiWorking: 'AI एजेंट काम कर रहे हैं...',
    textTruncated: 'दस्तावेज़ का टेक्स्ट लंबा है, जनरेशन के लिए पहले {n} अक्षरों का उपयोग किया जा रहा है',
    imageTruncated:
      '{total} चित्र मिले, जो {max} चित्र सीमा से अधिक हैं। अतिरिक्त चित्रों के लिए केवल टेक्स्ट विवरण का उपयोग किया जाएगा',
    // Agent generation
    agentGeneration: 'क्लासरूम रोल जनरेट किए जा रहे हैं',
    agentGenerationDesc: 'कोर्स कंटेंट के आधार पर रोल जनरेट किए जा रहे हैं...',
    agentRevealTitle: 'आपके क्लासरूम रोल',
    viewAgents: 'रोल देखें',
    continue: 'जारी रखें',
    // Outline errors
    outlineRetrying: 'रूपरेखा जनरेशन में समस्या, पुनः प्रयास किया जा रहा है...',
    outlineEmptyResponse:
      'मॉडल ने कोई मान्य रूपरेखा नहीं लौटाई। कृपया मॉडल कॉन्फ़िगरेशन जांचें और पुनः प्रयास करें',
    outlineGenerateFailed: 'रूपरेखा जनरेशन विफल रहा, कृपया बाद में पुनः प्रयास करें',
    // Web Search
    webSearching: 'वेब खोज',
    webSearchingDesc: 'ताज़ा जानकारी के लिए वेब पर खोज की जा रही है',
    webSearchFailed: 'वेब खोज विफल रही',
  },
} as const;

export const generationEnIN = generationEnUS;
