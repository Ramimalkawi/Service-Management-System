import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import logo from "../assets/logo-and-apple.png";
import "./TermsAndConditionsBilingual.css";

const englishSections = [
  {
    heading: "Terms and Conditions:",
    content: [
      {
        type: "paragraph",
        text: "Accepted Products: All Apple products (Mac, iPad, iPod, Apple Watch, Apple Accessories, iPhone (No Apple Inc. Coverage)). Only Apple-branded products, devices, and accessories are accepted. Non-Apple products, accessories, or devices are not accepted. 365 Solutions is not responsible for any data, Apple ID, Apple Accessories, System restoration, inspection reports, and detailed diagnostics – 100 JOD.",
      },
      {
        type: "heading",
        text: "Damaged Devices, Apple IDs, iCloud, Apple TV, AirPods, Beats, and Apple Accessories in the following cases:",
      },
      {
        type: "list",
        items: [
          "Devices that have been opened, with signs like mechanical liquid damage, or cases where it is discovered that the device was disassembled or significantly tampered with previously.",
          "Unprotected/unauthorized Apple IDs, iCloud, Apple TV, AirPods, Beats, and Apple Accessories.",
        ],
      },
      {
        type: "heading",
        text: "What is covered by the warranty?",
      },
      {
        type: "paragraph",
        text: "Apple warranty on Apple-branded hardware product and accessories against defects in materials and workmanship when used normally in accordance with Apple’s published guidelines for a period of ONE (1) YEAR from the date of original retail purchase by the end-user purchaser. Apple’s published guidelines include but are not limited to information contained in technical specifications, user manuals, and service communications.",
      },
      {
        type: "heading",
        text: "What is not covered by the warranty?",
      },
      {
        type: "list",
        items: [
          "Software, data loss, or virus infection.",
          "Damage caused by accident, abuse, misuse, liquid contact, fire, earthquake, or other external causes.",
          "Damage caused by operating the product outside Apple’s published guidelines.",
          "Damage caused by service (including upgrades and expansions) performed by anyone who is not a representative of Apple or an Apple Authorized Service Provider (AASP).",
        ],
      },
      {
        type: "heading",
        text: "General Notes and Customer Responsibilities:",
      },
      {
        type: "list",
        items: [
          "The copy of the service form should be presented when collecting your device.",
          "If the device is not collected within 30 days of notification, 365 Solutions has the right to dispose of the device as per the conditions of law.",
          "For devices with Apple warranty service but without the service report, this document will be considered as the customer’s agreement to the service conditions.",
          "Service fees are charged.",
          "365 Solutions is not responsible for any service not listed in the work order.",
          "365 Solutions is not responsible for any data loss or not collected within 30 days of notification of any Apple item (e.g., from iCloud, Apple ID, iTunes, and Find My iPhone).",
        ],
      },
      {
        type: "paragraph",
        text: "I hereby confirm that I have read/agreed on the terms and conditions stated above. I also release any pay for examination fee for the device does not meet the service conditions. Furthermore, I confirm that my personal information is accurate.",
      },
    ],
  },
];

const arabicSections = [
  {
    heading: "الشروط والأحكام:",
    content: [
      {
        type: "paragraph",
        text: "المنتجات المقبولة: جميع منتجات Apple (Mac, iPad, iPod, Apple Watch, ملحقات Apple, iPhone (بدون تغطية من Apple Inc.)). يتم قبول المنتجات والأجهزة والملحقات التي تحمل علامة Apple فقط. لا يتم قبول المنتجات أو الملحقات أو الأجهزة غير التابعة لـ Apple. لا تتحمل 365 Solutions أي مسؤولية عن أي بيانات أو معرف Apple أو ملحقات Apple أو استعادة النظام أو تقارير الفحص أو التشخيصات التفصيلية – 100 دينار.",
      },
      {
        type: "heading",
        text: "الأجهزة التالفة، معرفات Apple، iCloud، Apple TV، AirPods، Beats، وملحقات Apple في الحالات التالية:",
      },
      {
        type: "list",
        items: [
          "الأجهزة التي تم فتحها، مع وجود علامات مثل تلف ميكانيكي أو تلف سائل، أو الحالات التي يتم فيها اكتشاف أن الجهاز تم تفكيكه أو العبث به بشكل كبير سابقًا.",
          "معرفات Apple غير المحمية/غير المصرح بها، iCloud، Apple TV، AirPods، Beats، وملحقات Apple.",
        ],
      },
      {
        type: "heading",
        text: "ما الذي يغطيه الضمان؟",
      },
      {
        type: "paragraph",
        text: "يغطي ضمان Apple منتج الأجهزة والملحقات التي تحمل علامة Apple ضد العيوب في المواد والتصنيع عند استخدامها بشكل طبيعي وفقًا لإرشادات Apple المنشورة لمدة سنة واحدة (1) من تاريخ الشراء الأصلي من قبل المشتري النهائي. تشمل إرشادات Apple المنشورة، على سبيل المثال لا الحصر، المعلومات الواردة في المواصفات الفنية، ودلائل المستخدم، واتصالات الخدمة.",
      },
      {
        type: "heading",
        text: "ما الذي لا يغطيه الضمان؟",
      },
      {
        type: "list",
        items: [
          "البرمجيات، فقدان البيانات، أو إصابة الفيروسات.",
          "الأضرار الناتجة عن الحوادث أو سوء الاستخدام أو إساءة الاستخدام أو ملامسة السوائل أو الحريق أو الزلازل أو غيرها من الأسباب الخارجية.",
          "الأضرار الناتجة عن تشغيل المنتج خارج إرشادات Apple المنشورة.",
          "الأضرار الناتجة عن الخدمة (بما في ذلك الترقيات والتوسعات) التي يقوم بها أي شخص ليس ممثلًا لشركة Apple أو مقدم خدمة معتمد من Apple (AASP).",
        ],
      },
      {
        type: "heading",
        text: "ملاحظات عامة ومسؤوليات العميل:",
      },
      {
        type: "list",
        items: [
          "يجب تقديم نسخة من نموذج الخدمة عند استلام الجهاز.",
          "إذا لم يتم استلام الجهاز خلال 30 يومًا من الإخطار، يحق لـ 365 Solutions التصرف بالجهاز وفقًا لشروط القانون.",
          "بالنسبة للأجهزة التي لديها خدمة ضمان Apple ولكن بدون تقرير الخدمة، سيتم اعتبار هذا المستند بمثابة موافقة العميل على شروط الخدمة.",
          "يتم فرض رسوم الخدمة.",
          "لا تتحمل 365 Solutions أي مسؤولية عن أي خدمة غير مدرجة في أمر العمل.",
          "لا تتحمل 365 Solutions أي مسؤولية عن فقدان البيانات أو عدم استلامها خلال 30 يومًا من الإخطار بأي عنصر من عناصر Apple (مثل iCloud، معرف Apple، iTunes، وFind My iPhone).",
        ],
      },
      {
        type: "paragraph",
        text: "أقر بموجبه أنني قرأت/وافقت على الشروط والأحكام المذكورة أعلاه. كما أوافق على دفع رسوم الفحص للجهاز الذي لا يستوفي شروط الخدمة. علاوة على ذلك، أؤكد أن معلوماتي الشخصية دقيقة.",
      },
    ],
  },
];

function renderSection(section, lang) {
  return (
    <div
      className="terms-section"
      key={section.heading}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <h2>{section.heading}</h2>
      {section.content.map((item, idx) => {
        if (item.type === "heading") {
          return <h3 key={idx}>{item.text}</h3>;
        }
        if (item.type === "paragraph") {
          return <p key={idx}>{item.text}</p>;
        }
        if (item.type === "list") {
          return (
            <ul key={idx} className="terms-list">
              {item.items.map((li, i) => (
                <li key={i}>{li}</li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}

const TermsAndConditionsBilingual = React.forwardRef((props, ref) => (
  <div className="terms-bilingual-container" ref={ref}>
    <div className="terms-bilingual-header">
      <img src={logo} alt="Company Logo" className="terms-logo" />
      <h1 className="terms-title">Terms and Conditions / الشروط والأحكام</h1>
    </div>
    <div className="terms-bilingual-columns">
      <div className="terms-column terms-column-en">
        {englishSections.map((section) => renderSection(section, "en"))}
        <div className="signature-block">
          <div>Customer Name: ___________________________</div>
          <div>Personal ID: ___________________________</div>
          <div>Signature: ___________________________</div>
        </div>
      </div>
      <div className="terms-column terms-column-ar">
        {arabicSections.map((section) => renderSection(section, "ar"))}
        <div className="signature-block" dir="rtl">
          <div>اسم العميل: ___________________________</div>
          <div>الرقم الشخصي: ___________________________</div>
          <div>التوقيع: ___________________________</div>
        </div>
      </div>
    </div>
  </div>
));

export default function TermsAndConditionsBilingualPage() {
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: "Terms and Conditions Bilingual",
  });

  return (
    <div className="terms-page-wrapper">
      <button className="print-btn" onClick={handlePrint}>
        Print Terms and Conditions
      </button>
      <TermsAndConditionsBilingual ref={printRef} />
    </div>
  );
}
