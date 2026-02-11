const DETECTION_ITEMS = {
  l1: [
    { key: "email", defaultOn: true },
    { key: "phone", defaultOn: true },
    { key: "bank", defaultOn: true },
    { key: "address", defaultOn: true },
    { key: "id", defaultOn: true },
    { key: "cred", defaultOn: true }
  ],
  l2: [
    { key: "url", defaultOn: true },
    { key: "handle", defaultOn: true },
    { key: "ref", defaultOn: true }
  ],
  l3: [
    { key: "person", defaultOn: false },
    { key: "org", defaultOn: false },
    { key: "title", defaultOn: false }
  ]
};

window.DETECTION_ITEMS = DETECTION_ITEMS;

