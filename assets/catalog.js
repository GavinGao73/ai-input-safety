const DETECTION_ITEMS = {
  l1: [
    { key: "email", defaultOn: true },
    { key: "phone", defaultOn: true },
    { key: "bank", defaultOn: true },
    { key: "account", defaultOn: true },
    { key: "address_de_street", defaultOn: true }
  ],
  l2: [
    { key: "url", defaultOn: true },
    { key: "handle", defaultOn: true },
    { key: "ref", defaultOn: true },
    { key: "title", defaultOn: true }
  ],
  l3: [
    // Optional fallback: long numbers (OFF by default)
    { key: "number", defaultOn: false }
  ]
};

window.DETECTION_ITEMS = DETECTION_ITEMS;
