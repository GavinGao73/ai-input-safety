const DETECTION_ITEMS = {
  // L1 = 高风险/强隐私：默认开启（开箱安全）
  l1: [
    // comms
    { key: "email", defaultOn: true },
    { key: "phone", defaultOn: true },
    { key: "url", defaultOn: true },

    // auth / secrets
    { key: "secret", defaultOn: true },
    { key: "security_answer", defaultOn: true },

    // financial
    { key: "account", defaultOn: true },
    { key: "bank", defaultOn: true },
    { key: "bank_routing_ids", defaultOn: true },
    { key: "card_expiry", defaultOn: true },
    { key: "card_security", defaultOn: true },

    // identity（这里你可以选择默认开或默认关；我给“偏安全”的默认开）
    { key: "dob", defaultOn: true },
    { key: "place_of_birth", defaultOn: false },   // ↓更容易误伤/不常见，建议默认关
    { key: "id_card", defaultOn: true },
    { key: "passport", defaultOn: true },
    { key: "driver_license", defaultOn: true },
    { key: "license_plate", defaultOn: false },    // ↓噪声较大（车牌格式多样），建议默认关

    // tracking/device（强噪声：默认关，用户需要时再开）
    { key: "ip_label", defaultOn: false },
    { key: "ip_address", defaultOn: false },
    { key: "mac_label", defaultOn: false },
    { key: "mac_address", defaultOn: false },
    { key: "imei", defaultOn: false },
    { key: "device_fingerprint", defaultOn: false },
    { key: "uuid", defaultOn: false },

    // addresses（默认开）
    { key: "address_cn", defaultOn: true },
    { key: "address_de_street", defaultOn: true },
    { key: "address_en_inline_street", defaultOn: true },
    { key: "address_en_extra_block", defaultOn: false }, // ↓通常更“长块”，误伤成本高，建议默认关
    { key: "address_en_extra", defaultOn: false },

    // org/person
    { key: "company", defaultOn: true },
    { key: "person_name", defaultOn: true },

    // crypto / chain（默认关：只对特定用户有用，且误伤/误判成本高）
    { key: "wallet_id", defaultOn: false },
    { key: "tx_hash", defaultOn: false },
    { key: "crypto_wallet", defaultOn: false }
  ],

  // L2 = 中风险/可识别：默认开启，但允许用户关
  l2: [
    { key: "handle_label", defaultOn: true },
    { key: "handle", defaultOn: true },

    { key: "cust_id", defaultOn: true },
    { key: "ref_label_tail", defaultOn: true },
    { key: "ref", defaultOn: true },

    { key: "title", defaultOn: true }
  ],

  // L3 = 低风险/泛化：默认关闭
  l3: [
    // Money protection is controlled by M1/M2, keep key for consistency
    { key: "money", defaultOn: false },

    // generic
    { key: "number", defaultOn: false }
  ]
};

window.DETECTION_ITEMS = DETECTION_ITEMS;
