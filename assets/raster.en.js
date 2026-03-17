// =========================
// assets/raster.en.js
// Raster render profile: en
// 统一规则：Label 保留，只覆盖 Value
// 已按中文结构补齐字段（新增列表为空），并扩展 shrinkLabels 以匹配 engine.en.js 中的标签
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ =
    window.__RASTER_LANG_PACKS__ || {});

  PACKS.en = {
    lang: "en",
    version: "r1",

    // 全局高度削减（像素），值越大黑条越矮。英文建议 5
    globalHeightTrim: 30,        // 高度削减
    globalVerticalOffset: 30,     // 向下偏移更多，补偿上移

    limits: {
      maxMatchLen: {
        manual_term: 90,
        person_name: 40,
        person_name_keep_title: 40,
        account_holder_name_keep_title: 40,
        company: 70,
        email: 90,
        phone: 60,
        account: 90,
        bank: 140,
        address_en_inline_street: 160,
        address_en_extra_block: 160,
        address_en_extra: 160,
        handle: 90,
        ref: 90,
        title: 90,
        money: 70,
        money_label: 70,
        number: 70
      }
    },

    bbox: {
      default: {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      },

      longValue: {
        maxByPage: 0.70,
        maxByEst: 2.50,
        wHardCapEstRatio: 2.8,
        wSoftCapEstMul: 1.60
      },

      address: {
        maxByPage: 0.75,
        maxByEst: 2.40,
        wHardCapEstRatio: 3.2,
        wSoftCapEstMul: 1.70
      },

      money: {
        maxByPage: 0.35,
        maxByEst: 1.80
      },

      manual_term: {
        maxByPage: 0.40,
        maxByEst: 1.80
      }
    },

    pad: {
      person_name: { pxW: 0.002, pyH: 0.030, minX: 0.25, minY: 0.55 },

      company: { pxW: 0.004, pyH: 0.032, minX: 0.50, minY: 0.60 },

      manual_term: { pxW: 0.004, pyH: 0.035, minX: 0.55, minY: 0.65 },

      uuid: { pxW: 0.006, pyH: 0.045, minX: 0.8, minY: 0.75 },
      ip_address: { pxW: 0.006, pyH: 0.045, minX: 0.7, minY: 0.75 },
      wallet_id: { pxW: 0.006, pyH: 0.045, minX: 0.7, minY: 0.75 },

      _default: { pxW: 0.004, pyH: 0.035, minX: 0.5, minY: 0.70 }
    },

    shrinkLabels: {
      phone: [
        "Phone",
        "Mobile",
        "Tel",
        "Telephone",
        "Contact",
        "Cell",
        "Fax",
        "WhatsApp",
        "Telegram",
        "Signal"
      ],

      account: [
        "Account",
        "Account No",
        "Account Number",
        "IBAN",
        "Card Number",
        "Routing Number",
        "Bank Account",
        "Sort Code",
        "Credit Card",
        "Debit Card",
        "Name on Card"
      ],

      email: [
        "Email",
        "E-mail",
        "Email Address"
      ],

      address: [
        "Address",
        "Shipping Address",
        "Billing Address",
        "Mailing Address",
        "Office Address",
        "Street Address",
        "Zip Code",
        "Postal Code",
        "Postcode"
      ],

      bank: [
        "Bank",
        "Bank Name",
        "BIC",
        "SWIFT",
        "SWIFT/BIC",
        "Swift Code",
        "BIC Code"
      ],

      passport: [
        "Passport",
        "Passport Number",
        "Passport No"
      ],

      driver_license: [
        "Driver License",
        "Driver's License",
        "License",
        "DL"
      ],

      license_plate: [
        "License Plate",
        "Plate",
        "Registration"
      ],

      dob: [
        "Date of Birth",
        "DOB",
        "Birth Date"
      ],

      id_card: [
        "ID",
        "ID Card",
        "Identification",
        "Identity Card",
        "National ID",
        "National Identification Number"
      ],

      company: [
        "Company",
        "Company Name",
        "Organization",
        "Supplier",
        "Legal Entity",
        "Registered Company",
        "Billing Company"
      ],

      money: [
        "Amount",
        "Contract Amount",
        "Service Fee",
        "Tax Amount",
        "Total Amount",
        "USD",
        "Price",
        "Fee",
        "Charge",
        "Balance",
        "Paid",
        "Payment",
        "Refund",
        "Due",
        "Total Due",
        "Net",
        "Gross",
        "Tax",
        "VAT",
        "Subtotal",
        "Grand Total"
      ],

      ref: [
        "Reference",
        "Ref",
        "Reference ID",
        "Order Number",
        "Case ID",
        "Application ID",
        "Invoice Number",
        "Customer ID",
        "Reference Number",
        "Request ID",
        "Ticket ID",
        "Account ID",
        "Contract Number",
        "Claim Reference",
        "Legal Case Ref",
        "Application Number",
        "Order ID",
        "Invoice ID",
        "Case Number",
        "Ticket Number",
        "Customer Number"
      ],

      handle: [
        "Handle",
        "User",
        "Username",
        "User ID",
        "Login ID",
        "Login"
      ],

      person_name: [
        "Name",
        "Full Name",
        "Customer Name",
        "Contact Name",
        "Account Holder",
        "Account Manager",
        "Manager",
        "Agent",
        "Contact Person",
        "Support Agent",
        "Sales Manager",
        "Recipient",
        "Name on Card",
        "To",
        "Attn",
        "Attention",
        "Contact",
        "Customer"
      ],

      place_of_birth: [
        "Place of Birth",
        "Birthplace"
      ],

      secret: [
        "API Key",
        "Access Token",
        "Session ID",
        "Device ID",
        "IP Address",
        "MAC Address",
        "Secret",
        "Password",
        "Passcode",
        "PIN",
        "OTP",
        "2FA",
        "Verification Code",
        "Security Code",
        "One-Time Code",
        "Recovery Code",
        "Backup Code",
        "x-api-key",
        "Refresh Token",
        "Token",
        "Auth Token",
        "Client Secret",
        "Secret Key",
        "Authorization",
        "SSN",
        "Social Security Number",
        "EIN",
        "Employer Identification Number",
        "National ID",
        "ID Number",
        "Tax ID",
        "Tax Identification Number",
        "TIN",
        "Insurance ID",
        "Policy ID",
        "Claim ID",
        "Member ID",
        "Membership ID",
        "ITIN",
        "NINO",
        "NHS Number",
        "SIN",
        "TFN",
        "ABN",
        "IPv4",
        "IPv6",
        "MAC Address",
        "IMEI",
        "Device ID",
        "Fingerprint",
        "User Agent",
        "Account Number",
        "Routing Number",
        "Sort Code",
        "IBAN",
        "Credit Card",
        "Debit Card",
        "Card Number",
        "Name on Card",
        "SWIFT",
        "SWIFT Code",
        "BIC",
        "Bank Name",
        "Branch Code",
        "Clearing Number",
        "Transit Number",
        "BSB",
        "ABA",
        "Expiry Date",
        "Expiration Date",
        "Valid Thru",
        "Valid Through",
        "CVV",
        "CVC",
        "AVS Data",
        "3-D Secure",
        "3DS",
        "ECI",
        "Security Answer",
        "Wallet ID",
        "Transaction Hash",
        "TX Hash",
        "TXN Hash",
        "BTC",
        "ETH"
      ]
    },

    merge: {
      nearGapLegacy: 1.2,
      nearGapCore: 1.2,
      sameLineOverlapRatio: 0.88,
      similarHeightRatio: 0.80
    },

    itemBox: {
      fontHeightMul: 1.08,
      fontHeightMin: 6,
      fontHeightMax: 96,
      widthEstMul: 0.72,
      shortTokenCap: 1.10,
      hardCap: 1.18
    },

    rectBox: {
      fontHeightMul: 1.10,
      fontHeightMin: 6,
      fontHeightMax: 104,
      widthEstMul: 0.82
    },

    // ----- 以下为按中文结构补齐的字段 -----
    keyGroups: {
      longValueKeys: [],
      addressKeys: [],
      moneyKeys: []
    },

    wholeValueKeys: [],

    skipLabelShrinkKeys: [],

    collapseHitIdKeys: [],

    paragraphSensitiveKeys: [],

    englishInlineValueKeys: [],

    // 修改：移除了 ref 类 key，避免忽略 preferSub，让引擎的 preferSub 生效
    ignorePreferSubKeys: [
      // 保留一些可能需要标签收缩的字段（可根据需要调整）
      "person_name",
      "person_name_keep_title",
      "account_holder_name_keep_title",
      "company",
      "account",
      "phone",
      "money",
      "money_label",
      "address_en_inline_street",
      "address_en_street_line",
      "address_en_extra_block",
      "address_en_extra",
      "handle_label"
    ],

    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },

      padOverrides: {
        email: { pxW: 0.004, pyH: 0.030 },
        phone: { pxW: 0.004, pyH: 0.030 },
        account: { pxW: 0.004, pyH: 0.030 },
        money: { pxW: 0.004, pyH: 0.030 }
      },

      rectBoxSpecial: {}
    }
  };

})();
