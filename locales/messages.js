const DEFAULT_LANGUAGE = "en";

const LANGUAGE_LABELS = {
  en: "English",
  km: "ខ្មែរ",
};

const messages = {
  en: {
    buttons: {
      help: "How it works",
      language: "Language",
      donate: "Donate",
      support: "Support",
      source: "Source",
      back: "Back",
      english: "English",
      khmer: "Khmer",
      usd: "USD",
      khr: "KHR",
      checkPayment: "Check payment",
    },
    welcome: {
      title: "Multi-platform Media Bot",
      intro: "Hello <b>{{name}}</b>\n\nSend a TikTok, Facebook Reel, Instagram Reel, or YouTube link and I will detect it automatically.",
      featuresTitle: "Features",
      features: [
        "TikTok video download",
        "Facebook Reel and short video download",
        "Instagram Reel download",
        "YouTube video to MP3 conversion",
        "Automatic link detection from any message",
        "English and Khmer language switch",
      ],
      usageTitle: "Quick flow",
      usage: [
        "Tap share and copy a link from TikTok, Facebook, Instagram, or YouTube.",
        "Paste the link here.",
        "The bot detects the platform and sends video or MP3 automatically.",
      ],
      languageLine: "Current language: <b>{{language}}</b>",
    },
    help: {
      title: "How to use",
      body: [
        "Send one message with a public supported link.",
        "YouTube links are converted to MP3.",
        "TikTok, Facebook, and Instagram links are sent back as video.",
        "If a file is too large for Telegram, try a shorter clip.",
      ],
      supportedTitle: "Supported links",
      supported: [
        "TikTok video links",
        "Facebook Reel and short video links",
        "Instagram Reel links",
        "YouTube watch links and Shorts",
      ],
    },
    status: {
      blocked: "Access denied. Your account is blocked from using this bot.",
      noLink: "Send a TikTok, Facebook, Instagram Reel, or YouTube link and I will detect it automatically.",
      unsupported: "This link is not supported yet. Use TikTok, Facebook, Instagram Reel, or YouTube.",
      analyzing: "Analyzing your link...",
      downloadingVideo: "Downloading video...",
      downloadingAudio: "Converting video to MP3...",
      uploadingVideo: "Sending your video...",
      uploadingAudio: "Sending your MP3...",
      completedVideo: "Video ready.",
      completedAudio: "MP3 ready.",
      languageUpdated: "Language updated to English.",
      chooseLanguage: "Choose your language.",
      chooseCurrency: "Choose donation currency.",
      chooseAmount: "Choose a donation amount.",
      donateIntro: "Support the bot with KHQR or PayWay.",
      donateInstruction: "Scan the KHQR card, complete the payment, then tap <b>Check payment</b>.",
      donatePending: "Payment not found yet. If you just paid, wait a few seconds and check again.",
      donateExpired: "This KHQR card has expired. Please create a new one.",
      donateFailed: "Bakong reported this transaction as failed.",
      donateUnsupported: "This QR cannot be checked automatically. Please generate a new donation QR.",
      donateVerificationUnavailable: "Bakong payment verification is not configured yet.",
      donateVerificationAuthError: "Bakong payment verification is not authorized. Request or renew the Bakong API token.",
      donateSuccess: "Thank you <b>{{name}}</b> for supporting our bot.",
      donateSuccessShort: "Payment confirmed. Thank you for supporting the bot.",
      source: "Source code:\n{{url}}",
      contact: "Support:\n{{url}}",
      qrError: "Unable to generate the donation QR code right now.",
      genericError: "I could not process that link. Try a public link or try again in a moment.",
      toolMissing: "Server setup is incomplete. Install yt-dlp and ffmpeg on the host first.",
      fileTooLarge: "The processed file is too large for Telegram. Try a shorter or lower-size link.",
      privateLink: "That media is unavailable, private, or restricted.",
    },
    caption: {
      prefix: "Link",
    },
  },
  km: {
    buttons: {
      help: "របៀបប្រើ",
      language: "ភាសា",
      donate: "បរិច្ចាគ",
      support: "ជំនួយ",
      source: "Source",
      back: "ត្រឡប់ក្រោយ",
      english: "English",
      khmer: "ខ្មែរ",
      usd: "USD",
      khr: "KHR",
      checkPayment: "ពិនិត្យការទូទាត់",
    },
    welcome: {
      title: "ប៊ុតទាញយកមេឌៀច្រើនវេទិកា",
      intro: "សួស្តី <b>{{name}}</b>\n\nផ្ញើតំណ TikTok, Facebook Reel, Instagram Reel ឬ YouTube មក ខ្ញុំនឹងស្គាល់តំណដោយស្វ័យប្រវត្តិ។",
      featuresTitle: "មុខងារ",
      features: [
        "ទាញយកវីដេអូ TikTok",
        "ទាញយក Facebook Reel និងវីដេអូខ្លី",
        "ទាញយក Instagram Reel",
        "បម្លែង YouTube ទៅជា MP3",
        "ចាប់តំណដោយស្វ័យប្រវត្តិពីសារ",
        "ប្តូរភាសា អង់គ្លេស និង ខ្មែរ",
      ],
      usageTitle: "របៀបប្រើខ្លីៗ",
      usage: [
        "ចម្លងតំណពី TikTok, Facebook, Instagram ឬ YouTube។",
        "បិទភ្ជាប់តំណនៅទីនេះ។",
        "ប៊ុតនឹងស្គាល់វេទិកា ហើយផ្ញើវីដេអូ ឬ MP3 មកវិញដោយស្វ័យប្រវត្តិ។",
      ],
      languageLine: "ភាសាបច្ចុប្បន្ន: <b>{{language}}</b>",
    },
    help: {
      title: "របៀបប្រើ",
      body: [
        "ផ្ញើសារមួយដែលមានតំណសាធារណៈដែលគាំទ្រ។",
        "តំណ YouTube នឹងត្រូវបម្លែងទៅជា MP3។",
        "តំណ TikTok, Facebook និង Instagram នឹងផ្ញើជាវីដេអូមកវិញ។",
        "បើឯកសារធំពេកសម្រាប់ Telegram សូមសាកល្បងវីដេអូខ្លីជាងនេះ។",
      ],
      supportedTitle: "តំណដែលគាំទ្រ",
      supported: [
        "តំណវីដេអូ TikTok",
        "តំណ Facebook Reel និងវីដេអូខ្លី",
        "តំណ Instagram Reel",
        "តំណ YouTube និង Shorts",
      ],
    },
    status: {
      blocked: "គណនីរបស់អ្នកត្រូវបានទប់ស្កាត់ មិនអាចប្រើប៊ុតនេះបានទេ។",
      noLink: "សូមផ្ញើតំណ TikTok, Facebook, Instagram Reel ឬ YouTube ហើយខ្ញុំនឹងស្គាល់វាដោយស្វ័យប្រវត្តិ។",
      unsupported: "តំណនេះមិនទាន់គាំទ្រទេ។ សូមប្រើ TikTok, Facebook, Instagram Reel ឬ YouTube។",
      analyzing: "កំពុងពិនិត្យតំណ...",
      downloadingVideo: "កំពុងទាញយកវីដេអូ...",
      downloadingAudio: "កំពុងបម្លែងទៅជា MP3...",
      uploadingVideo: "កំពុងផ្ញើវីដេអូ...",
      uploadingAudio: "កំពុងផ្ញើ MP3...",
      completedVideo: "វីដេអូរួចរាល់។",
      completedAudio: "MP3 រួចរាល់។",
      languageUpdated: "បានប្តូរភាសាទៅជា ខ្មែរ។",
      chooseLanguage: "សូមជ្រើសរើសភាសា។",
      chooseCurrency: "សូមជ្រើសរើសរូបិយប័ណ្ណសម្រាប់បរិច្ចាគ។",
      chooseAmount: "សូមជ្រើសរើសចំនួនទឹកប្រាក់បរិច្ចាគ។",
      donateIntro: "គាំទ្រប៊ុតតាម KHQR ឬ PayWay។",
      donateInstruction: "សូមស្កេនកាត KHQR បង់ប្រាក់រួចហើយ ចុច <b>ពិនិត្យការទូទាត់</b>។",
      donatePending: "រកមិនឃើញការទូទាត់នៅឡើយទេ។ បើទើបបង់ សូមរង់ចាំបន្តិច ហើយពិនិត្យម្តងទៀត។",
      donateExpired: "កាត KHQR នេះបានផុតកំណត់ហើយ។ សូមបង្កើតកាតថ្មីម្តងទៀត។",
      donateFailed: "Bakong បានរាយការណ៍ថាការទូទាត់នេះបរាជ័យ។",
      donateUnsupported: "QR នេះមិនអាចពិនិត្យដោយស្វ័យប្រវត្តិបានទេ។ សូមបង្កើត QR បរិច្ចាគថ្មី។",
      donateVerificationUnavailable: "ការផ្ទៀងផ្ទាត់ការទូទាត់ Bakong មិនទាន់បានកំណត់ទេ។",
      donateVerificationAuthError: "ការផ្ទៀងផ្ទាត់ការទូទាត់ Bakong មិនទាន់មានសិទ្ធិទេ។ សូមស្នើ ឬបន្តសុពលភាព API token ឡើងវិញ។",
      donateSuccess: "អរគុណ <b>{{name}}</b> ដែលបានគាំទ្រប៊ុតរបស់យើង។",
      donateSuccessShort: "ការទូទាត់បានជោគជ័យ។ អរគុណសម្រាប់ការគាំទ្រប៊ុត។",
      source: "Source code:\n{{url}}",
      contact: "ទំនាក់ទំនង:\n{{url}}",
      qrError: "មិនអាចបង្កើត QR បរិច្ចាគបានទេនៅពេលនេះ។",
      genericError: "មិនអាចដំណើរការតំណនេះបានទេ។ សូមសាកល្បងតំណសាធារណៈ ឬព្យាយាមម្តងទៀតបន្តិចក្រោយ។",
      toolMissing: "ម៉ាស៊ីនមេមិនទាន់រួចរាល់ទេ។ សូមដំឡើង yt-dlp និង ffmpeg មុនសិន។",
      fileTooLarge: "ឯកសារធំពេកសម្រាប់ Telegram។ សូមសាកល្បងវីដេអូខ្លីជាងនេះ។",
      privateLink: "មេឌៀនេះមិនអាចចូលបានទេ ប្រហែលជា private ឬ restricted។",
    },
    caption: {
      prefix: "Link",
    },
  },
};

function getValue(language, path) {
  return path.split(".").reduce((current, key) => {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      return current[key];
    }

    return undefined;
  }, messages[language] || messages[DEFAULT_LANGUAGE]);
}

function interpolate(value, variables = {}) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

function t(language, path, variables = {}) {
  const resolvedLanguage = messages[language] ? language : DEFAULT_LANGUAGE;
  const primary = getValue(resolvedLanguage, path);
  const fallback = getValue(DEFAULT_LANGUAGE, path);
  const target = primary === undefined ? fallback : primary;

  if (Array.isArray(target)) {
    return target.map((item) => interpolate(item, variables));
  }

  return interpolate(target, variables);
}

module.exports = {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  messages,
  t,
};
