// =========================
// assets/raster.de.js
// Raster render profile: de
// 已按中文结构补齐字段（新增列表为空），并扩展 shrinkLabels 以匹配 engine.de.js 中的标签
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ = window.__RASTER_LANG_PACKS__ || {});

  PACKS.de = {
    lang: "de",
    version: "r1",

    // 全局高度削减（像素），值越大黑条越矮。德语建议 5
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

        address_de_street: 160,
        address_de_postal: 160,
        address_de_street_partial: 160,
        address_de_extra_partial: 160,
        address_de_inline_street: 160,
        address_en_inline_street: 160,
        address_en_extra_block: 160,
        address_en_extra: 160,
        address_cn: 160,

        handle: 90,
        ref: 90,
        title: 90,
        money: 70,
        money_label: 70,
        number: 70
      }
    },

    bbox: {
      default: { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
      longValue: { maxByPage: 0.55, maxByEst: 2.20, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
      address: { maxByPage: 0.60, maxByEst: 2.10, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
      money: { maxByPage: 0.35, maxByEst: 1.80 },
      manual_term: { maxByPage: 0.40, maxByEst: 1.80 }
    },

    pad: {
      person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      person_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      account_holder_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      company: { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
      manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
      _default: { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
    },

    shrinkLabels: {
      // 电话类
      phone: [
        "Telefon", "Tel", "Handy", "Mobil", "Mobile", "Phone", "Kontakt",
        "Mobiltelefon", "Festnetz", "Fax", "Telefonnummer", "Rufnummer"
      ],

      // 账户类（包括银行账号、信用卡等）
      account: [
        "Konto", "Kontonummer", "Account", "IBAN", "Kontoinhaber",
        "Bankverbindung", "Kreditkarte", "Kartennummer", "Kreditkartennummer",
        "Kreditkarten-Nr.", "Kreditkartentyp", "Karteninhaber", "CVC", "CVV",
        "CVC2", "CAV2"
      ],

      // 电子邮件
      email: [
        "E-mail", "Email", "E-Mail", "Mail", "E-Mail-Adresse", "Mailadresse",
        "Kontakt-E-Mail", "Kunden-E-Mail"
      ],

      // 地址类
      address: [
        "Anschrift", "Adresse", "Address", "Rechnungsadresse", "Lieferadresse",
        "Straße", "Strasse", "Postadresse", "Versandadresse", "Hausadresse",
        "Geschäftsadresse", "Privatadresse", "Wohnadresse", "Hauptadresse",
        "Zusatz", "Adresszusatz", "Adressergänzung"
      ],

      // 银行类
      bank: [
        "Bank", "Bankname", "BIC", "SWIFT", "Bankleitzahl", "BLZ",
        "Kreditinstitut", "Bankverbindung", "Bankleitzahl (BLZ)", "SWIFT-Code",
        "SWIFT/BIC", "BIC/SWIFT"
      ],

      // 人名类（不包括尊称）
      person_name: [
        "Name", "Kundename", "Kunde", "Kontaktperson", "Kontakt",
        "Ansprechpartner", "Ansprechperson", "Sachbearbeiter", "Bearbeiter",
        "Empfänger", "Rechnungsempfänger", "Versicherte Person", "Patient",
        "Kontoinhaber"
      ],

      // 公司类
      company: [
        "Firma", "Unternehmen", "GmbH", "AG", "GmbH & Co. KG", "UG",
        "KGaA", "OHG", "PartG", "eG", "GbR", "e.K.", "Company", "Organization",
        "Supplier", "Legal Entity", "Registered Company", "Billing Company",
        "Firmenname", "Firmenbezeichnung", "Handelsname"
      ],

      // 参考编号类
      ref: [
        "Referenznummer", "Referenz", "Ref", "REF", "Bestellnummer", "Vertragsnummer",
        "Ticketnummer", "Kundennummer", "Vorgangs-ID", "Vorgangsnummer",
        "Interne Sicherheitsreferenz", "Rechtsfall-Referenz", "Claim Reference",
        "Aktenzeichen", "Geschäftszeichen", "Antragsnummer", "Rechnungsnummer",
        "Rechnungsnr", "Rechnungs-Nr.", "Liefernummer", "Lieferscheinnummer",
        "Schadensnummer", "Schadennummer", "Schaden-Nr.", "Legal Case Ref",
        "Contract Number", "Police(n)nummer", "Policen-Nr.", "Policy Number",
        "Member ID", "Mitgliedsnummer", "Versicherungsnummer", "Versichertennummer",
        "Krankenversichertennummer", "Sozialversicherungsnummer", "SV-Nummer",
        "Rentenversicherungsnummer", "Steuer-ID", "Steueridentifikationsnummer",
        "USt-IdNr", "Umsatzsteuer-ID", "VAT ID"
      ],

      // 金额类
      money: [
        "Betrag", "Preis", "Gesamtbetrag", "Zwischensumme", "Umsatzsteuer",
        "Gutschrift", "Summe", "Total", "Netto", "Brutto", "Rechnungsbetrag",
        "Zahlungsbetrag", "Kosten", "Gebühr", "Rabatt", "Nachlass", "Einrichtungsgebühr",
        "Monatliche Rate", "Vertragswert", "Kulanznachlass", "Service Fee",
        "Tax Amount", "Total Amount", "Contract Amount", "Amount"
      ],

      // 用户名/句柄类
      handle: [
        "User", "Benutzername", "Login", "Username", "Account", "Login-ID",
        "User-ID", "Benutzerkennung", "Loginname", "Kontoname", "Handle"
      ],

      // 身份证件类
      id_card: [
        "ID", "Identifikation", "Personalausweis", "Personalausweisnummer",
        "Ausweisnummer", "Ausweis", "ID-Nummer", "Identifikationsnummer"
      ],

      // 护照类
      passport: [
        "Pass", "Reisepass", "Reisepassnummer", "Passnummer", "Pass-Nr."
      ],

      // 驾照类
      driver_license: [
        "Führerschein", "Führerscheinnummer", "Führerschein-Nr.", "Fuehrerschein",
        "Führerscheinklasse", "Fahrerlaubnis", "Fahrerlaubnisnummer"
      ],

      // 车牌类
      license_plate: [
        "Kennzeichen", "Nummernschild", "Kfz-Kennzeichen", "Auto-Kennzeichen",
        "Fahrzeugkennzeichen"
      ],

      // 出生日期类
      dob: [
        "Geburtsdatum", "Geb. Datum", "Geburtstag", "Geburtsjahr",
        "Date of Birth", "DOB", "Birth Date"
      ],

      // 出生地类
      place_of_birth: [
        "Geburtsort", "Geburtsstadt", "Birthplace"
      ],

      // 秘密/敏感信息类
      secret: [
        "Geheim", "API Key", "Access Token", "Session ID", "Device ID",
        "IP Adresse", "MAC Adresse", "Passwort", "Kennwort", "PIN", "TAN",
        "OTP", "2FA", "Sicherheitscode", "Client Secret", "Auth Token",
        "Authorization", "Bearer", "Security Answer", "Answer", "Sicherheitsantwort",
        "Antwort", "Zugangsdaten", "Login-Daten", "Authentifizierungscode",
        "Bestätigungscode", "Transaktionsnummer", "Transaction Number",
        "Geheimcode", "Geheimzahl", "Persönliche Identifikationsnummer"
      ],

      // 日期时间类
      datetime: [
        "Login Zeit", "Datum", "Zeit", "Gültig bis", "Ablaufdatum", "Expiry",
        "Expiration", "Valid Thru", "Valid Through", "Gueltig bis", "Gültigkeitsdatum",
        "Ausstellungsdatum", "Erstellungsdatum", "Zugriffszeit", "Letzte Änderung",
        "Letzter Login", "Zeitpunkt", "Timestamp"
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

    // 新增：忽略 preferSub 的 key 列表，强制使用标签收缩，覆盖整个值
    ignorePreferSubKeys: [
      "ref_generic_tail_de",
      "id_label_tail",
      "aktenzeichen_tail",
      "legal_ref_tail",
      "cust_id",
      "person_name_keep_title",
      "account_holder_name_keep_title",
      "person_name",
      "company",
      "account",
      "phone",
      "money",
      "money_label",
      "address_de_inline_street",
      "address_de_street_partial",
      "address_de_extra_partial",
      "klingel_name",
      "handle_label"
    ],

    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },
      padOverrides: {},
      rectBoxSpecial: {}
    }
  };
})();
