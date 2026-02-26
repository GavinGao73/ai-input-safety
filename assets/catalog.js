const DETECTION_ITEMS = {
  // L1 = 高风险/强隐私：默认开启（基本不建议让用户关）
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

    // identity
    { key: "dob", defaultOn: true },
    { key: "place_of_birth", defaultOn: true },
    { key: "id_card", defaultOn: true },
    { key: "passport", defaultOn: true },
    { key: "driver_license", defaultOn: true },
    { key: "license_plate", defaultOn: true },

    // tracking/device
    { key: "ip_label", defaultOn: true },
    { key: "ip_address", defaultOn: true },
    { key: "mac_label", defaultOn: true },
    { key: "mac_address", defaultOn: true },
    { key: "imei", defaultOn: true },
    { key: "device_fingerprint", defaultOn: true },
    { key: "uuid", defaultOn: true },

    // addresses (keep the ones you already use + future-proof for EN)
    { key: "address_cn", defaultOn: true },
    { key: "address_de_street", defaultOn: true },
    { key: "address_en_inline_street", defaultOn: true },
    { key: "address_en_extra_block", defaultOn: true },
    { key: "address_en_extra", defaultOn: true },

    // org/person (你现在 company 强制 included，但 UI 也应可见)
    { key: "company", defaultOn: true },
    { key: "person_name", defaultOn: true },

    // crypto / chain
    { key: "wallet_id", defaultOn: true },
    { key: "tx_hash", defaultOn: true },
    { key: "crypto_wallet", defaultOn: true }
  ],

  // L2 = 中风险/可识别：默认开启，但允许用户关
  l2: [
    // handles / user ids
    { key: "handle_label", defaultOn: true },
    { key: "handle", defaultOn: true },

    // refs / ids
    { key: "cust_id", defaultOn: true },
    { key: "ref_label_tail", defaultOn: true },
    { key: "ref", defaultOn: true },

    // titles
    { key: "title", defaultOn: true }
  ],

  // L3 = 低风险/泛化：默认关闭（需要时用户再开）
  l3: [
    // Money protection is controlled by UI (M1/M2), but keep as a key for consistency
    { key: "money", defaultOn: false },

    // generic
    { key: "number", defaultOn: false }
  ]
};

window.DETECTION_ITEMS = DETECTION_ITEMS;
