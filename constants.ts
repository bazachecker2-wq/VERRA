
export const CONFIDENCE_THRESHOLD = 0.55; // Чуть ниже, чтобы ловить больше объектов, фильтруем трекером
export const DETECTION_INTERVAL_MS = 100;
export const FOCUS_ACQUISITION_MS = 250; // 4 раза в секунду (быстрый захват)

export const MAX_DETECTION_DISTANCE = 25.0;

// API KEYS
export const MINIMAX_API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJKb2huIFJlYXZlciIsIlVzZXJOYW1lIjoiSm9obiBSZWF2ZXIiLCJBY2NvdW50IjoiIiwiU3ViamVjdElEIjoiMTk4MzUxNjE2MDU3Mzg0MTQ5OCIsIlBob25lIjoiIiwiR3JvdXBJRCI6IjE5ODM1MTYxNjA1Njk2NDMwOTgiLCJQYWdlTmFtZSI6IiIsIk1haWwiOiJiYXphY2hlY2tlckBnbWFpbC5jb20iLCJDcmVhdGVUaW1lIjoiMjAyNS0xMS0wOSAyMDoyMTowNiIsIlRva2VuVHlwZSI6MSwiaXNzIjoibWluaW1heCJ9.C_gIdT7VpOg74He1CMISDM-virkRB-PnrfAVb9QatQwX6RsqoD09tKMRRBtrFrkskE4xC82-IFbQ62VwO1cE4OQeqfnZZAehUGeg2FTl8pqzvWgSRolj1dDJNjXpRM8ORwEgmfn1yd-NPPDiGY7xwFR3VQdNlFSQTPHCP9CJCauVc-2gSPk-ASGZnlXMhKi9PZOqynezZkO319BxS5TnsKe6tPgTLlnmBXYKh35Ds7RhQ4h7liQ0iEIde5G96DyjxcHuYgzwrYcztCcjZNlsR_InNqLk2og7nC7U_R53DXJcMi9ab__omahrEIeIGb7lDeRjCtwaRKfwLL6EighINg";
export const MINIMAX_GROUP_ID = "1983516160569643098"; // Extracted from JWT
export const MISTRAL_API_KEY = "cAPwhFeAkvUFKuk8GR8YIivITQvOKILz";

// Тактический перевод классов (COCO-SSD -> Russian Military HUD)
export const CLASS_TRANSLATIONS: Record<string, string> = {
  // PERSON & BIO
  'person': 'БИО_ЕДИНИЦА',
  'cat': 'ЦЕЛЬ_КОШАЧЬИ',
  'dog': 'ЦЕЛЬ_ПСОВЫЕ',
  'bird': 'БИО_ВОЗДУХ',
  'horse': 'БИО_КРУПН',
  'sheep': 'СКОТ_МЕЛК',
  'cow': 'СКОТ_КРУПН',
  'elephant': 'БИО_ГИГАНТ',
  'bear': 'БИО_ОПАСН',
  'zebra': 'БИО_ДКИЙ',
  'giraffe': 'БИО_ВЫСОК',
  
  // VEHICLES
  'bicycle': 'ВЕЛО_ТРАНСП',
  'car': 'АВТО_ЛГК',
  'motorcycle': 'МОТО_ТРАНСП',
  'airplane': 'ВОЗД_СУДНО',
  'bus': 'АВТО_ПАСС',
  'train': 'ЖД_СОСТАВ',
  'truck': 'ГРУЗОВИК',
  'boat': 'ВОДН_СУДНО',
  'traffic light': 'СВЕТОФОР',
  'fire hydrant': 'ГИДРАНТ',
  'stop sign': 'ЗНАК_СТОП',
  'parking meter': 'ПАРКОМАТ',
  'bench': 'СКАМЬЯ',

  // ELECTRONICS & INDOOR
  'cell phone': 'УСТР_СВЯЗИ',
  'laptop': 'ТЕРМИНАЛ',
  'tv': 'ЭКРАН_БОЛ',
  'remote': 'ПУЛЬТ_УПР',
  'keyboard': 'ВВОД_ДАННЫХ',
  'mouse': 'МАНИПУЛЯТОР',
  'microwave': 'СВЧ_ПЕЧЬ',
  'oven': 'ПЕЧЬ',
  'toaster': 'ТОСТЕР',
  'sink': 'РАКОВИНА',
  'refrigerator': 'ХОЛОД_УСТ',
  
  // OBJECTS
  'backpack': 'РЮКЗАК_ТАКТ',
  'umbrella': 'ЗОНТ',
  'handbag': 'СУМКА_РУЧН',
  'tie': 'АКСЕССУАР_ШЕЯ',
  'suitcase': 'КЕЙС_ГРУЗ',
  'frisbee': 'ДИСК_СПОРТ',
  'skis': 'ЛЫЖИ',
  'snowboard': 'СНОУБОРД',
  'sports ball': 'СФЕРА_СПОРТ',
  'kite': 'ВОЗД_ЗМЕЙ',
  'baseball bat': 'БИТА',
  'baseball glove': 'ПЕРЧАТКА',
  'skateboard': 'ДОСКА_РОЛИК',
  'surfboard': 'СЕРФ',
  'tennis racket': 'РАКЕТКА',
  'bottle': 'ЕМКОСТЬ_ЖИДК',
  'wine glass': 'БОКАЛ',
  'cup': 'КРУЖКА',
  'fork': 'ВИЛКА',
  'knife': 'НОЖ',
  'spoon': 'ЛОЖКА',
  'bowl': 'ЧАША',
  'banana': 'ПИЩА_ФРУКТ',
  'apple': 'ПИЩА_ФРУКТ',
  'sandwich': 'ПИЩА_СЛОЖ',
  'orange': 'ПИЩА_ФРУКТ',
  'broccoli': 'ПИЩА_ОВОЩ',
  'carrot': 'ПИЩА_ОВОЩ',
  'hot dog': 'ПИЩА_ФАСТ',
  'pizza': 'ПИЩА_ФАСТ',
  'donut': 'ПИЩА_СЛАД',
  'cake': 'ПИЩА_СЛАД',
  'chair': 'МЕСТО_СИД',
  'couch': 'МЕСТО_ОТДХ',
  'potted plant': 'ФЛОРА',
  'bed': 'ЗОНА_СНА',
  'dining table': 'СТОЛ',
  'toilet': 'САН_УЗЕЛ',
  'book': 'КНИГА_ДАННЫЕ',
  'clock': 'ХРОНОМЕТР',
  'vase': 'КЕРАМИКА',
  'scissors': 'РЕЖ_ИНСТР',
  'teddy bear': 'ИГРУШКА',
  'hair drier': 'ТЕРМО_ФЕН',
  'toothbrush': 'ГИГИЕНА'
};
