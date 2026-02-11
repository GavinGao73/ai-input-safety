const DETECTION_ITEMS = {
  l1: [
    { key: "email", defaultOn: true },
    { key: "phone", defaultOn: true },
    { key: "bank", defaultOn: true },
    { key: "account", defaultOn: true },
    { key: "address_de_street", defaultOn: true }
  ],
  l2: [
    { key: "handle", defaultOn: true },
    { key: "ref", defaultOn: true },
    { key: "title", defaultOn: true }
  ],
  l3: [
    // Money protection is controlled by UI (M1/M2), but keep as a key for consistency
    { key: "money", defaultOn: false },
    { key: "number", defaultOn: false }
  ]
};

window.DETECTION_ITEMS = DETECTION_ITEMS;
