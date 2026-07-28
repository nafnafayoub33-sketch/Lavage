/**
 * src/lib/i18n.ts
 * Three languages, one source. Arabic is the default and the only RTL one.
 *
 * npx expo install i18next react-i18next expo-localization expo-updates \
 *   @react-native-async-storage/async-storage
 *
 * Keys are grouped by screen group, mirroring docs/SCREENS.md.
 * When a group passes ~40 keys, move it to src/lib/locales/<lng>/<group>.json —
 * the API below does not change.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

export const LANGS = ['ar', 'fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const RTL_LANGS: Lang[] = ['ar'];

const STORAGE_KEY = 'app.lang';

/* ------------------------------------------------------------------ */

const ar = {
  common: {
    continue: 'كمل', cancel: 'إلغاء', confirm: 'تأكيد', save: 'سجل', edit: 'عدل',
    delete: 'حذف', retry: 'عاود', later: 'من بعد', allow: 'واخا', close: 'سد',
    call: 'اتصال', directions: 'الطريق', seeAll: 'شوف الكل', minutes: 'دقيقة',
  },
  auth: {
    language: 'اختار اللغة',
    phoneTitle: 'شنو هو رقم التيليفون ديالك؟',
    phoneSub: 'غادي نصيفطو ليك كود بـSMS.',
    sendCode: 'صيفط الكود',
    terms: 'ملي تكمل، نتا موافق على الشروط وسياسة الخصوصية.',
    phoneInvalid: 'الرقم ماشي صحيح. خاصو يبدا بـ6 ولا 7.',
    phoneBlocked: 'هاد الرقم مسدود. تواصل مع الدعم.',
    smsLimit: 'طلبتي بزاف ديال الأكواد. تسنى شوية وعاود.',
    otpTitle: 'دخل الكود',
    otpSub: 'صيفطنا كود لـ{{phone}}',
    changeNumber: 'بدل الرقم',
    resend: 'عاود صيفط', resendIn: 'عاود صيفط من بعد {{seconds}} ثانية',
    otpWrong: 'الكود غالط. باقي ليك {{attempts}} محاولات.',
    otpExpired: 'الكود تسالا الوقت ديالو. طلب واحد جديد.',
    otpLocked: 'حاولتي بزاف. عاود من بعد {{minutes}} دقيقة.',
    roleTitle: 'شكون نتا؟',
    roleClient: 'عندي طوموبيل', roleOwner: 'عندي لافاج',
    roleWarn: 'ما تقدرش تبدل هاد الاختيار من بعد إلا عن طريق الإدارة.',
    nameTitle: 'شنو سميتك؟', namePlaceholder: 'الاسم الكامل',
    cityPlaceholder: 'المدينة',
    permTitle: 'قبل ما نبداو',
    permLocationTitle: 'الموقع',
    permLocation: 'باش نوريو ليك اللافاجات القريبة ليك',
    permNotificationsTitle: 'الإشعارات',
    permNotifications: 'باش نعيطو ليك ملي توصل نوبتك',
  },
  queue: {
    near: 'قريب منك', myTurn: 'نوبتي',
    free: 'خاوي', busy: 'متوسط', full: 'عامر',
    open: 'مفتوح', closed: 'مسدود', opensAt: 'كيحل {{time}}',
    yourNumber: 'الرقم ديالك', nowWashing: 'دابا كيغسلو',
    queueNow: 'الطابور دابا',
    ahead_one: 'بقات قبلك طوموبيل وحدة',
    ahead_other: 'بقاو قبلك {{count}} ديال الطوموبيلات',
    eta: 'تقريباً {{minutes}} دقيقة',
    etaSub: 'غادي نعيطو ليك ملي تبقى طوموبيل وحدة.',
    youAreUp: 'دورك دابا',
    washing: 'الطوموبيل ديالك دابا فالغسيل',
    noBooking: 'ماعندك حتى نوبة دابا',
    nowServing: 'دابا كيغسلو رقم {{number}}',
    cancelledByOwner: 'اللافاج لغى الحجز ديالك',
    findAnother: 'قلب على لافاج آخر',
    banner: 'عندك نوبة فـ{{wash}} · رقم {{number}}',
  },
  booking: {
    book: 'حجز نوبتك', service: 'الخدمة', vehicle: 'الطوموبيل',
    payment: 'طريقة الخلاص', cash: 'كاش', card: 'كارط بنكية',
    summary: 'الملخص', price: 'الثمن', duration: 'المدة',
    expectedNumber: 'الرقم المتوقع ديالك',
    confirmed: 'تسجل الحجز ديالك',
    cancelTitle: 'واخا تلغي الحجز؟',
    cancelWarn: 'إلا لغيتي مرات بزاف ما تبقاش تقدر تحجز.',
    activeExists: 'عندك حجز نشيط. سالي بيه قبل ما تحجز واحد آخر.',
    blocked: 'ما تقدرش تحجز حتى {{time}} حيت ما جيتيش 3 مرات.',
    confirmDone: 'واش سالى الغسيل؟',
    rate: 'قيّم الخدمة', comment: 'تعليق (اختياري)',
    confirmAndRate: 'أكد وقيّم', problem: 'كاين مشكل',
    imOnTheWay: 'أنا فالطريق', iArrived: 'وصلت',
    notSaid: 'ما قالش',
  },
  wash: {
    services: 'الخدمات والأثمنة', hours: 'أوقات الخدمة',
    priceFrom: 'من {{price}}',
    distanceM: '{{value}} م', distanceKm: '{{value}} كم',
    waitMinutes: '{{value}} د', waitHours: '{{value}} س',
    waitHoursMinutes: '{{hours}}س {{minutes}}د',
    searchPlaceholder: 'قلب على لافاج',
    showMap: 'الخريطة', showList: 'اللائحة',
    sortNearest: 'الأقرب', sortFastest: 'الأسرع',
    sortCheapest: 'الأرخص', sortRated: 'الأحسن',
    widenSearch: 'وسع البحث',
    noMatch: 'ماكاين حتى لافاج بهاد الاسم.',
    turnOnLocation: 'شعل الموقع',
    openSettings: 'حل الإعدادات',
    reviews: 'آراء الكليان', reviewsCount: '{{count}} تقييم',
    everyday: 'كل يوم', from: 'من',
  },
  owner: {
    queue: 'الطابور', balance: 'الرصيد', topup: 'شحن',
    start: 'بدا', done: 'سالى', noShow: 'ما جاش',
    onTheWay: 'فالطريق', arrived: 'واصل', startedAgo: 'بدا من {{minutes}} دقيقة',
    closedToday: 'مقفول اليوم',
    emptyQueue: 'الطابور خاوي دابا',
    lowCredit: 'الرصيد ديالك أقل من 10 دراهم — شحن قبل ما تختافي.',
    noCredit: 'ما كتبانش للكليان. شحن الرصيد باش ترجع.',
    freeLeft: 'باقي ليك {{count}} غسلة مجانية',
    myWash: 'المحل ديالي', stats: 'الإحصائيات',
    newBooking: 'حجز جديد',
    todayQueue: 'طابور اليوم',
    topupNow: 'شحن دابا',
    noWashYet: 'مازال ما سجلتي حتى لافاج.',
    confirmNoShow: 'واش الكليان ما جاش؟',
    confirmClose: 'واخا تسد اليوم؟ ما غاديش يقدرو يحجزو.',
    reopen: 'حل من جديد',
    freeWashes: 'غسلات مجانية',
    addWalkIn: 'زيد كليان',
    walkInLabel: 'الاسم ولا الطوموبيل',
    walkInHint: 'مثلا: كليو حمرا، ولا سعيد',
    walkInPick: 'شنو الخدمة؟',
    walkInBadge: 'بلا تطبيق',
    walkInNeedsService: 'خاصك تزيد خدمة وحدة على الأقل قبل.',
    confirmWalkIn: 'أكد وخلص',
    transactions: 'الحركات',
    topupTitle: 'شحن الرصيد',
    topupAmount: 'شحال بغيتي تشحن؟',
    topupCustom: 'مبلغ آخر',
    bankDetails: 'حول لهاد الحساب',
    bankMissing: 'الإدارة مازال ما دخلاتش معلومات الحساب البنكي.',
    reference: 'مرجع التحويل',
    referencePlaceholder: 'رقم العملية',
    referenceNeeded: 'خاصك تكتب مرجع التحويل.',
    amountTooSmall: 'أقل مبلغ هو {{amount}}.',
    submitTopup: 'صيفط الطلب',
    topupPending: 'الطلب ديالك عند الإدارة. غادي نشحنو ملي نتأكدو من التحويل.',
    topupRejected: 'الطلب تسد: {{reason}}',
    noTransactions: 'مازال ماكاين حتى حركة.',
    txTopup: 'شحن', txCharge: 'خصم', txRefund: 'إرجاع', txBonus: 'مجاني',
    servicesTitle: 'الخدمات والأثمنة',
    addService: 'زيد خدمة',
    serviceName: 'اسم الخدمة',
    servicePrice: 'الثمن بالدرهم',
    serviceDuration: 'المدة بالدقائق',
    serviceActive: 'مفعلة',
    noServices: 'مازال ما زدتي حتى خدمة. بلا خدمات ما يقدرش الكليان يحجز.',
    durationOdd: 'المدة كتبان ماشي معقولة. كتأثر على وقت الانتظار.',
    deleteService: 'تمسح هاد الخدمة؟',
    washTitle: 'المحل ديالي',
    washName: 'اسم اللافاج', washDescription: 'الوصف',
    washAddress: 'العنوان', washPhone: 'التيليفون',
    bays: 'عدد الأماكن', opensAt: 'كيحل', closesAt: 'كيسد',
    saved: 'تسجل',
    cancelReason: 'علاش كتلغي؟',
    reasons: {
      closed_today: 'مقفول اليوم', no_water: 'ماكاينش الما',
      power_cut: 'طاح الضو', too_busy: 'عامر بزاف', holiday: 'عطلة', other: 'سبب آخر',
    },
  },
  account: {
    title: 'حسابي', points: 'النقط', washes: 'غسلات',
    pointsNext: 'باقي ليك {{count}} غسلات باش تاخد وحدة مجانية',
    vehicles: 'الطوموبيلات ديالي', addVehicle: 'زيد طوموبيل', default: 'الأساسية',
    settings: 'الإعدادات', language: 'اللغة', appearance: 'المظهر',
    system: 'حسب التيليفون', light: 'فاتح', dark: 'داكن',
    paymentMethods: 'طرق الخلاص', history: 'الغسلات السابقة',
    invite: 'عرض على صاحبك', support: 'المساعدة', logout: 'خروج',
    deleteAccount: 'حذف الحساب',
    restartNeeded: 'خاص التطبيق يعاود يشعل باش تتبدل اللغة.',
  },
  admin: {
    dashboard: 'اللوحة',
    approvals: 'الطلبات',
    waiting: '{{count}} طلبات كيتسناو',
    noPending: 'ماكاين حتى طلب كيتسنى.',
    owner: 'المول',
    bays: '{{count}} أماكن',
    hours: 'من {{from}} ل {{to}}',
    serviceCount: '{{count}} خدمات',
    noServices: 'مازال ما زاد حتى خدمة — ماغاديش يقدرو يحجزو.',
    appliedOn: 'طلب فـ {{date}}',
    approve: 'قبل',
    reject: 'رفض',
    confirmApprove: 'واخا يبان هاد اللافاج للكليان؟',
    rejectTitle: 'علاش كترفض؟',
    rejectHint: 'كتب السبب — المول غادي يقراه.',
    rejectSend: 'صيفط الرفض',
    reasonRequired: 'خاصك تكتب السبب.',
  },
  empty: {
    noWash: 'ماكاين حتى لافاج مفتوح قريب منك دابا.',
    noHistory: 'مازال ما غسلتي حتى مرة.',
    locationOff: 'شعل الموقع باش نوريو ليك اللافاجات القريبة.',
  },
  error: {
    network: 'ماكاينش الأنترنيت. عاود جرب.',
    generic: 'وقع شي مشكل. عاود جرب.',
    offline: 'ماكاينش الأنترنيت — كتشوف معلومات قديمة.',
  },
};

const fr: typeof ar = {
  common: {
    continue: 'Continuer', cancel: 'Annuler', confirm: 'Confirmer', save: 'Enregistrer',
    edit: 'Modifier', delete: 'Supprimer', retry: 'Réessayer', later: 'Plus tard',
    allow: 'Autoriser', close: 'Fermer', call: 'Appeler', directions: 'Itinéraire',
    seeAll: 'Tout voir', minutes: 'minutes',
  },
  auth: {
    language: 'Choisis ta langue',
    phoneTitle: 'Quel est ton numéro ?',
    phoneSub: 'On t\u2019envoie un code par SMS.',
    sendCode: 'Envoyer le code',
    terms: 'En continuant, tu acceptes les conditions et la politique de confidentialité.',
    phoneInvalid: 'Numéro invalide. Il doit commencer par 6 ou 7.',
    phoneBlocked: 'Ce numéro est bloqué. Contacte le support.',
    smsLimit: 'Trop de codes demandés. Patiente un moment avant de réessayer.',
    otpTitle: 'Saisis le code',
    otpSub: 'Code envoyé au {{phone}}',
    changeNumber: 'Changer de numéro',
    resend: 'Renvoyer', resendIn: 'Renvoyer dans {{seconds}} s',
    otpWrong: 'Code incorrect. Il te reste {{attempts}} essais.',
    otpExpired: 'Le code a expiré. Demandes-en un nouveau.',
    otpLocked: 'Trop de tentatives. Réessaie dans {{minutes}} minutes.',
    roleWarn: 'Seul un administrateur peut modifier ce choix plus tard.',
    roleTitle: 'Tu es…',
    roleClient: 'J\u2019ai une voiture', roleOwner: 'J\u2019ai un lavage',
    nameTitle: 'Comment tu t\u2019appelles ?', namePlaceholder: 'Nom complet',
    cityPlaceholder: 'Ville',
    permTitle: 'Avant de commencer',
    permLocationTitle: 'Localisation',
    permLocation: 'Pour te montrer les lavages les plus proches',
    permNotificationsTitle: 'Notifications',
    permNotifications: 'Pour te prévenir quand ton tour arrive',
  },
  queue: {
    near: 'Près de toi', myTurn: 'Mon tour',
    free: 'Libre', busy: 'Moyen', full: 'Complet',
    open: 'Ouvert', closed: 'Fermé', opensAt: 'Ouvre à {{time}}',
    yourNumber: 'Ton numéro', nowWashing: 'En cours',
    queueNow: 'File en ce moment',
    ahead_one: '1 voiture avant toi',
    ahead_other: '{{count}} voitures avant toi',
    eta: 'Environ {{minutes}} minutes',
    etaSub: 'On te prévient quand il ne reste qu\u2019une voiture.',
    youAreUp: 'C\u2019est ton tour',
    washing: 'Ta voiture est en cours de lavage',
    noBooking: 'Tu n\u2019as pas de tour en cours',
    nowServing: 'En cours : n\u00b0 {{number}}',
    cancelledByOwner: 'Le lavage a annulé ta réservation',
    findAnother: 'Trouver un autre lavage',
    banner: 'Tu as un tour chez {{wash}} · n° {{number}}',
  },
  booking: {
    book: 'Réserver mon tour', service: 'Service', vehicle: 'Voiture',
    payment: 'Paiement', cash: 'Espèces', card: 'Carte bancaire',
    summary: 'Récapitulatif', price: 'Prix', duration: 'Durée',
    expectedNumber: 'Ton numéro estimé',
    confirmed: 'Réservation confirmée',
    cancelTitle: 'Annuler la réservation ?',
    cancelWarn: 'Annuler trop souvent peut bloquer tes réservations.',
    activeExists: 'Tu as déjà une réservation en cours.',
    blocked: 'Réservation bloquée jusqu\u2019à {{time}} après 3 absences.',
    confirmDone: 'Le lavage est terminé ?',
    rate: 'Note le service', comment: 'Commentaire (optionnel)',
    confirmAndRate: 'Confirmer et noter', problem: 'Il y a un problème',
    imOnTheWay: 'Je suis en route', iArrived: 'Je suis arrivé',
    notSaid: 'pas indiqué',
  },
  wash: {
    services: 'Services et prix', hours: 'Horaires',
    priceFrom: 'dès {{price}}',
    distanceM: '{{value}} m', distanceKm: '{{value}} km',
    waitMinutes: '{{value}} min', waitHours: '{{value}} h',
    waitHoursMinutes: '{{hours}} h {{minutes}}',
    searchPlaceholder: 'Chercher un lavage',
    showMap: 'Carte', showList: 'Liste',
    sortNearest: 'Au plus près', sortFastest: 'Au plus rapide',
    sortCheapest: 'Au moins cher', sortRated: 'Les mieux notés',
    widenSearch: 'Élargir la recherche',
    noMatch: 'Aucun lavage à ce nom.',
    turnOnLocation: 'Activer la localisation',
    openSettings: 'Ouvrir les réglages',
    reviews: 'Avis', reviewsCount: '{{count}} avis',
    everyday: 'Tous les jours', from: 'dès',
  },
  owner: {
    queue: 'File d\u2019attente', balance: 'Solde', topup: 'Recharger',
    start: 'Démarrer', done: 'Terminé', noShow: 'Absent',
    onTheWay: 'en route', arrived: 'sur place', startedAgo: 'démarré il y a {{minutes}} min',
    closedToday: 'Fermé aujourd\u2019hui',
    emptyQueue: 'Aucune voiture en attente',
    lowCredit: 'Ton solde est sous 10 DH — recharge avant de disparaître.',
    noCredit: 'Tu n\u2019es plus visible. Recharge pour revenir.',
    freeLeft: 'Il te reste {{count}} lavages offerts',
    myWash: 'Mon lavage', stats: 'Statistiques',
    newBooking: 'Nouvelle réservation',
    todayQueue: 'File du jour',
    topupNow: 'Recharger maintenant',
    noWashYet: 'Tu n\u2019as pas encore enregistré de lavage.',
    confirmNoShow: 'Le client n\u2019est pas venu ?',
    confirmClose: 'Fermer pour aujourd\u2019hui ? Plus personne ne pourra réserver.',
    reopen: 'Rouvrir',
    freeWashes: 'lavages offerts',
    addWalkIn: 'Ajouter un client',
    walkInLabel: 'Nom ou voiture',
    walkInHint: 'Par exemple : Clio rouge, ou Said',
    walkInPick: 'Quel service ?',
    walkInBadge: 'sans appli',
    walkInNeedsService: 'Ajoute d\u2019abord au moins un service.',
    confirmWalkIn: 'Confirmer et facturer',
    transactions: 'Mouvements',
    topupTitle: 'Recharger le solde',
    topupAmount: 'Combien veux-tu recharger ?',
    topupCustom: 'Autre montant',
    bankDetails: 'Vire sur ce compte',
    bankMissing: 'L\u2019administration n\u2019a pas encore renseigné le compte bancaire.',
    reference: 'Référence du virement',
    referencePlaceholder: 'Numéro de l\u2019opération',
    referenceNeeded: 'Indique la référence du virement.',
    amountTooSmall: 'Le minimum est {{amount}}.',
    submitTopup: 'Envoyer la demande',
    topupPending: 'Ta demande est chez l\u2019administration. Le solde sera crédité après vérification.',
    topupRejected: 'Demande refusée : {{reason}}',
    noTransactions: 'Aucun mouvement pour le moment.',
    txTopup: 'Recharge', txCharge: 'Prélèvement', txRefund: 'Remboursement', txBonus: 'Offert',
    servicesTitle: 'Services et prix',
    addService: 'Ajouter un service',
    serviceName: 'Nom du service',
    servicePrice: 'Prix en DH',
    serviceDuration: 'Durée en minutes',
    serviceActive: 'Actif',
    noServices: 'Aucun service. Sans service, personne ne peut réserver.',
    durationOdd: 'Cette durée semble irréaliste. Elle sert à estimer l\u2019attente.',
    deleteService: 'Supprimer ce service ?',
    washTitle: 'Mon lavage',
    washName: 'Nom du lavage', washDescription: 'Description',
    washAddress: 'Adresse', washPhone: 'Téléphone',
    bays: 'Nombre de places', opensAt: 'Ouvre à', closesAt: 'Ferme à',
    saved: 'Enregistré',
    cancelReason: 'Pourquoi cette annulation ?',
    reasons: {
      closed_today: 'Fermé aujourd\u2019hui', no_water: 'Pas d\u2019eau',
      power_cut: 'Coupure de courant', too_busy: 'Trop de monde',
      holiday: 'Congé', other: 'Autre raison',
    },
  },
  account: {
    title: 'Mon compte', points: 'Points', washes: 'lavages',
    pointsNext: 'Encore {{count}} lavages avant ton lavage offert',
    vehicles: 'Mes voitures', addVehicle: 'Ajouter une voiture', default: 'principale',
    settings: 'Réglages', language: 'Langue', appearance: 'Apparence',
    system: 'Système', light: 'Clair', dark: 'Sombre',
    paymentMethods: 'Moyens de paiement', history: 'Historique',
    invite: 'Parrainer un ami', support: 'Aide', logout: 'Se déconnecter',
    deleteAccount: 'Supprimer le compte',
    restartNeeded: 'L\u2019app doit redémarrer pour changer de langue.',
  },
  admin: {
    dashboard: 'Tableau de bord',
    approvals: 'Demandes',
    waiting: '{{count}} demandes en attente',
    noPending: 'Aucune demande en attente.',
    owner: 'Propriétaire',
    bays: '{{count}} places',
    hours: 'De {{from}} à {{to}}',
    serviceCount: '{{count}} services',
    noServices: 'Aucun service au tarif — personne ne pourra réserver.',
    appliedOn: 'Demande du {{date}}',
    approve: 'Accepter',
    reject: 'Refuser',
    confirmApprove: 'Rendre ce lavage visible aux clients ?',
    rejectTitle: 'Pourquoi refuses-tu ?',
    rejectHint: 'Écris la raison — le propriétaire la lira.',
    rejectSend: 'Envoyer le refus',
    reasonRequired: 'La raison est obligatoire.',
  },
  empty: {
    noWash: 'Aucun lavage ouvert près de toi pour le moment.',
    noHistory: 'Tu n\u2019as encore fait aucun lavage.',
    locationOff: 'Active la localisation pour voir les lavages proches.',
  },
  error: {
    network: 'Pas de connexion. Réessaie.',
    generic: 'Une erreur est survenue. Réessaie.',
    offline: 'Hors ligne — tu vois des données anciennes.',
  },
};

const en: typeof ar = {
  common: {
    continue: 'Continue', cancel: 'Cancel', confirm: 'Confirm', save: 'Save',
    edit: 'Edit', delete: 'Delete', retry: 'Retry', later: 'Later',
    allow: 'Allow', close: 'Close', call: 'Call', directions: 'Directions',
    seeAll: 'See all', minutes: 'minutes',
  },
  auth: {
    language: 'Choose your language',
    phoneTitle: 'What\u2019s your phone number?',
    phoneSub: 'We\u2019ll send you a code by SMS.',
    sendCode: 'Send the code',
    terms: 'By continuing, you accept the terms and the privacy policy.',
    phoneInvalid: 'Invalid number. It has to start with 6 or 7.',
    phoneBlocked: 'This number is blocked. Contact support.',
    smsLimit: 'Too many codes requested. Wait a moment before trying again.',
    otpTitle: 'Enter the code',
    otpSub: 'Code sent to {{phone}}',
    changeNumber: 'Change number',
    resend: 'Resend', resendIn: 'Resend in {{seconds}}s',
    otpWrong: 'Wrong code. {{attempts}} attempts left.',
    otpExpired: 'The code has expired. Ask for a new one.',
    otpLocked: 'Too many attempts. Try again in {{minutes}} minutes.',
    roleWarn: 'Only an admin can change this later.',
    roleTitle: 'You are…',
    roleClient: 'I have a car', roleOwner: 'I own a car wash',
    nameTitle: 'What\u2019s your name?', namePlaceholder: 'Full name',
    cityPlaceholder: 'City',
    permTitle: 'Before we start',
    permLocationTitle: 'Location',
    permLocation: 'So we can show the car washes closest to you',
    permNotificationsTitle: 'Notifications',
    permNotifications: 'So we can tell you when your turn comes',
  },
  queue: {
    near: 'Near you', myTurn: 'My turn',
    free: 'Free', busy: 'Busy', full: 'Full',
    open: 'Open', closed: 'Closed', opensAt: 'Opens at {{time}}',
    yourNumber: 'Your number', nowWashing: 'Now washing',
    queueNow: 'Queue right now',
    ahead_one: '1 car ahead of you',
    ahead_other: '{{count}} cars ahead of you',
    eta: 'About {{minutes}} minutes',
    etaSub: 'We\u2019ll ping you when one car is left.',
    youAreUp: 'You\u2019re up',
    washing: 'Your car is being washed',
    noBooking: 'You don\u2019t have a turn right now',
    nowServing: 'Now washing no. {{number}}',
    cancelledByOwner: 'The car wash cancelled your booking',
    findAnother: 'Find another car wash',
    banner: 'You have a place at {{wash}} · no. {{number}}',
  },
  booking: {
    book: 'Book my turn', service: 'Service', vehicle: 'Car',
    payment: 'Payment', cash: 'Cash', card: 'Card',
    summary: 'Summary', price: 'Price', duration: 'Duration',
    expectedNumber: 'Your expected number',
    confirmed: 'Booking confirmed',
    cancelTitle: 'Cancel this booking?',
    cancelWarn: 'Cancelling often can block you from booking.',
    activeExists: 'You already have an active booking.',
    blocked: 'Booking blocked until {{time}} after 3 no-shows.',
    confirmDone: 'Is the wash finished?',
    rate: 'Rate the service', comment: 'Comment (optional)',
    confirmAndRate: 'Confirm and rate', problem: 'Something\u2019s wrong',
    imOnTheWay: 'I\u2019m on the way', iArrived: 'I\u2019ve arrived',
    notSaid: 'not said',
  },
  wash: {
    services: 'Services & prices', hours: 'Hours',
    priceFrom: 'from {{price}}',
    distanceM: '{{value}} m', distanceKm: '{{value}} km',
    waitMinutes: '{{value}} min', waitHours: '{{value}} h',
    waitHoursMinutes: '{{hours}}h {{minutes}}',
    searchPlaceholder: 'Search for a car wash',
    showMap: 'Map', showList: 'List',
    sortNearest: 'Nearest', sortFastest: 'Fastest',
    sortCheapest: 'Cheapest', sortRated: 'Best rated',
    widenSearch: 'Widen the search',
    noMatch: 'No car wash by that name.',
    turnOnLocation: 'Turn on location',
    openSettings: 'Open settings',
    reviews: 'Reviews', reviewsCount: '{{count}} reviews',
    everyday: 'Every day', from: 'from',
  },
  owner: {
    queue: 'Queue', balance: 'Balance', topup: 'Top up',
    start: 'Start', done: 'Done', noShow: 'No-show',
    onTheWay: 'on the way', arrived: 'arrived', startedAgo: 'started {{minutes}} min ago',
    closedToday: 'Closed today',
    emptyQueue: 'No cars waiting',
    lowCredit: 'Your balance is under 10 DH — top up before you disappear.',
    noCredit: 'You\u2019re hidden from clients. Top up to come back.',
    freeLeft: '{{count}} free washes left',
    myWash: 'My car wash', stats: 'Stats',
    newBooking: 'New booking',
    todayQueue: 'Today\u2019s queue',
    topupNow: 'Top up now',
    noWashYet: 'You haven\u2019t registered a car wash yet.',
    confirmNoShow: 'The client didn\u2019t come?',
    confirmClose: 'Close for today? Nobody will be able to book.',
    reopen: 'Reopen',
    freeWashes: 'free washes',
    addWalkIn: 'Add a customer',
    walkInLabel: 'Name or car',
    walkInHint: 'For example: red Clio, or Said',
    walkInPick: 'Which service?',
    walkInBadge: 'no app',
    walkInNeedsService: 'Add at least one service first.',
    confirmWalkIn: 'Confirm and bill',
    transactions: 'Transactions',
    topupTitle: 'Top up',
    topupAmount: 'How much do you want to add?',
    topupCustom: 'Another amount',
    bankDetails: 'Transfer to this account',
    bankMissing: 'The admin has not filled in the bank account yet.',
    reference: 'Transfer reference',
    referencePlaceholder: 'Operation number',
    referenceNeeded: 'Give the transfer reference.',
    amountTooSmall: 'The minimum is {{amount}}.',
    submitTopup: 'Send the request',
    topupPending: 'Your request is with the admin. The balance is credited once the transfer is checked.',
    topupRejected: 'Request declined: {{reason}}',
    noTransactions: 'No transactions yet.',
    txTopup: 'Top-up', txCharge: 'Charge', txRefund: 'Refund', txBonus: 'Free',
    servicesTitle: 'Services & prices',
    addService: 'Add a service',
    serviceName: 'Service name',
    servicePrice: 'Price in DH',
    serviceDuration: 'Duration in minutes',
    serviceActive: 'Active',
    noServices: 'No services yet. Without one, nobody can book.',
    durationOdd: 'That duration looks unrealistic. It drives the wait estimate.',
    deleteService: 'Delete this service?',
    washTitle: 'My car wash',
    washName: 'Car wash name', washDescription: 'Description',
    washAddress: 'Address', washPhone: 'Phone',
    bays: 'Number of bays', opensAt: 'Opens at', closesAt: 'Closes at',
    saved: 'Saved',
    cancelReason: 'Why are you cancelling?',
    reasons: {
      closed_today: 'Closed today', no_water: 'No water',
      power_cut: 'Power cut', too_busy: 'Too busy',
      holiday: 'Holiday', other: 'Other reason',
    },
  },
  account: {
    title: 'My account', points: 'Points', washes: 'washes',
    pointsNext: '{{count}} more washes until your free one',
    vehicles: 'My cars', addVehicle: 'Add a car', default: 'default',
    settings: 'Settings', language: 'Language', appearance: 'Appearance',
    system: 'System', light: 'Light', dark: 'Dark',
    paymentMethods: 'Payment methods', history: 'History',
    invite: 'Invite a friend', support: 'Support', logout: 'Log out',
    deleteAccount: 'Delete account',
    restartNeeded: 'The app needs to restart to change language.',
  },
  admin: {
    dashboard: 'Dashboard',
    approvals: 'Applications',
    waiting: '{{count}} waiting',
    noPending: 'No application is waiting.',
    owner: 'Owner',
    bays: '{{count}} bays',
    hours: 'From {{from}} to {{to}}',
    serviceCount: '{{count}} services',
    noServices: 'Nothing on the price list — nobody would be able to book.',
    appliedOn: 'Applied {{date}}',
    approve: 'Approve',
    reject: 'Reject',
    confirmApprove: 'Make this car wash visible to clients?',
    rejectTitle: 'Why are you rejecting it?',
    rejectHint: 'Write the reason — the owner reads it.',
    rejectSend: 'Send the rejection',
    reasonRequired: 'The reason is required.',
  },
  empty: {
    noWash: 'No car wash is open near you right now.',
    noHistory: 'You haven\u2019t washed anything yet.',
    locationOff: 'Turn on location to see nearby car washes.',
  },
  error: {
    network: 'No connection. Try again.',
    generic: 'Something went wrong. Try again.',
    offline: 'Offline — you\u2019re seeing older data.',
  },
};

const resources = {
  ar: { translation: ar },
  fr: { translation: fr },
  en: { translation: en },
} as const;

/* ------------------------------------------------------------------ */

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode as Lang | undefined;
  return code && LANGS.includes(code) ? code : 'ar';
}

export async function initI18n() {
  const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as Lang | null;
  const lng = saved ?? deviceLang();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

  await applyDirection(lng, { reload: false });
  return i18n;
}

/**
 * React Native cannot flip layout direction live — it needs a restart.
 * Do it once, right after the user picks a language.
 *
 * Returns true when the direction changed but the restart did not happen, so
 * the caller can tell the user the app still needs to restart. The strings and
 * the language have already switched at that point; only the layout mirroring
 * is pending.
 */
async function applyDirection(lng: Lang, { reload }: { reload: boolean }): Promise<boolean> {
  const shouldBeRTL = RTL_LANGS.includes(lng);
  if (I18nManager.isRTL === shouldBeRTL) return false;

  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);
  if (!reload) return true;

  try {
    await Updates.reloadAsync();
    return false;
  } catch {
    // Throws in Expo Go and in any build without expo-updates enabled — which
    // is every development build. Not an error worth crashing on: the language
    // did change, the mirroring just waits for the next launch.
    return true;
  }
}

export type LanguageChange = {
  /**
   * The layout direction changed but the app could not restart itself.
   * Show the user `t('account.restartNeeded')`.
   */
  restartNeeded: boolean;
};

export async function setLanguage(lng: Lang): Promise<LanguageChange> {
  await AsyncStorage.setItem(STORAGE_KEY, lng);
  await i18n.changeLanguage(lng);
  const restartNeeded = await applyDirection(lng, { reload: true });
  return { restartNeeded };
}

export const currentLang = () => i18n.language as Lang;

/**
 * A2 is "first launch only". There is no separate flag for that: a stored
 * language only ever gets written by setLanguage(), so its absence is exactly
 * "the user has never chosen". Changing the language later is C14.
 */
export async function hasChosenLanguage(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) !== null;
}

/**
 * Money is stored in centimes everywhere. Format only at render time.
 */
export const formatDH = (centimes: number, lng: Lang = currentLang()) =>
  new Intl.NumberFormat(lng === 'ar' ? 'ar-MA' : lng === 'fr' ? 'fr-MA' : 'en-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(centimes / 100);

/**
 * A day and a month, for "applied on" and the like. Never a bare
 * toLocaleDateString(): that follows the device locale, not the language the
 * user picked, so an Arabic UI on a French phone would date things in French.
 *
 * `-u-nu-latn` pins Latin digits, per the same rule as prices.
 */
export const formatDate = (iso: string, lng: Lang = currentLang()) =>
  new Intl.DateTimeFormat(
    lng === 'ar' ? 'ar-MA-u-nu-latn' : lng === 'fr' ? 'fr-MA' : 'en-MA',
    { day: '2-digit', month: 'short' },
  ).format(new Date(iso));

/**
 * Numbers, prices, plates and ticket numbers stay Latin and LTR in every
 * language. Wrap them: <Text style={numeric}>{value}</Text> using the
 * `numeric` style from src/ui/theme.ts. Never build a sentence by
 * concatenation — always interpolate, or Arabic breaks around the digits.
 */

export default i18n;
