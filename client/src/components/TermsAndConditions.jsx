import React from "react";
import "./TermsAndConditions.css";

// TermsAndConditions.jsx — bilingual (English + Arabic)
// Mirrors your PDF content and layout as closely as possible.

export default function TermsAndConditions({ companyName = "" }) {
  return (
    <div className="t-page">
      {/* ---------- English Section ---------- */}
      <header className="t-header">
        <h1>Terms and Conditions</h1>
      </header>

      <section className="t-section">
        <h2>Supported Products</h2>
        <p>
          All Apple computers, iPad, iPod, Apple Watch, Apple Accessories,
          iPhone (As Apple Inc, Coverage)
        </p>
      </section>

      <section className="t-section">
        <h2>Our service</h2>
        <p>
          Software restoration, diagnoses, under warranty and out of warranty
          repairs and many more….
        </p>
        <ul>
          <li>
            <strong>macOS Devices (Mac):</strong> System reinstallation with
            updates – <strong>JOD 35</strong>, Diagnostic inspection fee –
            <strong> JOD 25</strong>.
          </li>
          <li>
            <strong>iOS Devices & Accessories</strong> (iPhone, iPad, Apple TV,
            Apple Accessories): System reinstallation, inspection reports, and
            detailed diagnostics – <strong>JOD 25</strong>.
          </li>
        </ul>
      </section>

      <section className="t-section">
        <h2>Diagnoses Charges JOD 15 for:</h2>
        <p>
          (iPhone, Mac, iPad, Apple Watch, Apple TV, AirPods, Beats, and Apple
          Accessories) in the following cases:
        </p>
        <ul>
          <li>Out-of-warranty devices on which quotations are rejected.</li>
          <li>
            Devices whose warranty is void due to accidental or liquid damage,
            or discovered to have been opened or repaired by unauthorised
            personnel.
          </li>
        </ul>
      </section>

      <section className="t-section">
        <h2>What is covered by the warranty?</h2>
        <p>
          Apple warrants the Apple-branded hardware product and accessories
          contained in the original packaging (“Apple Product”) against defects
          in materials and workmanship when used normally in accordance with
          Apple’s published guidelines for one (1) year from the date of
          original retail purchase by the end-user purchaser (“Warranty
          Period”).
        </p>
      </section>

      <section className="t-section">
        <h2>What is not covered by Warranty?</h2>
        <p>
          The warranty does not apply to any non-Apple-branded hardware product
          or software, even if packaged or sold with Apple hardware.
          Manufacturers, suppliers or publishers other than Apple may provide
          their own warranties, but Apple — insofar as permitted by law —
          provides their products “AS IS”.
        </p>
        <p>
          Software distributed by Apple (including system software) is not
          covered by this warranty. Apple does not warrant uninterrupted or
          error-free operation or damages from misuse.
        </p>
        <h3>This warranty does not apply:</h3>
        <ol>
          <li>
            To consumable parts (e.g. batteries) unless failure is due to
            defect.
          </li>
          <li>
            To cosmetic damage (scratches, dents, broken plastic on ports).
          </li>
          <li>To damage caused by use with another product.</li>
          <li>
            To damage from accident, abuse, misuse, fire, liquid contact,
            earthquake, or other external causes.
          </li>
          <li>
            To damage from operating the product outside Apple’s guidelines.
          </li>
          <li>
            To damage from service by anyone who is not Apple or an authorised
            provider (AASP).
          </li>
          <li>To a product modified without Apple’s written permission.</li>
          <li>To defects due to normal wear and tear or aging.</li>
          <li>If any serial number has been removed or defaced.</li>
          <li>
            If Apple receives notice the product is stolen or locked by passcode
            and ownership cannot be proven.
          </li>
        </ol>
      </section>

      <section className="t-section">
        <h2>Beyond Our Scope of Support (In-Warranty)</h2>
        <ul>
          <li>Software defects due to OS malfunction or user data issues.</li>
          <li>
            Windows OS or software installed via Boot Camp, VMware, Parallels,
            etc.
          </li>
          <li>
            Apps not part of macOS (Adobe, Microsoft Office, Outlook, AutoCAD,
            etc.).
          </li>
          <li>
            Apple products serviced by unauthorised providers or technicians.
          </li>
          <li>Products serviced with unauthorised tools or non-Apple parts.</li>
        </ul>
      </section>

      <section className="t-section">
        <h2>Global Warranty and AppleCare Protection Plan</h2>
        <p>
          Any Apple product purchased from an authorised reseller with a valid
          limited hardware warranty will be serviced free of charge. Apple may
          restrict warranty service for iPhone and iPad to the country of sale.
        </p>
        <p>
          For more information visit:{" "}
          <span className="t-link">http://www.apple.com/legal/warranty</span>
        </p>
        <p className="t-note">
          (For international warranty, bring the original invoice from the
          country of purchase.)
        </p>
      </section>

      <section className="t-section">
        <h2>Out of Warranty Service</h2>
        <p>
          Products out of warranty are serviced at customer expense after a
          quote and approval. If the quote is rejected, a diagnostic fee
          applies.
        </p>
      </section>

      <section className="t-section">
        <h2>Accessories</h2>
        <p>
          We do not accept accessories unrelated to the repair (cases, bags,
          etc.); the service centre is not liable for missing or damaged
          accessories.
        </p>
        <p>
          For liquid/accidental damage or unauthorised modification, the unit
          may not be returned in the same condition if service is declined.
        </p>
      </section>

      <section className="t-section">
        <h2>Customer Responsibility and Data</h2>
        <ul>
          <li>Proof of purchase may be required.</li>
          <li>Back up your data before service.</li>
          <li>
            The service centre is not responsible for any loss of data or
            software.
          </li>
        </ul>
      </section>

      <section className="t-section">
        <h2>Service Terms and Conditions</h2>
        <ul>
          <li>
            Unit received for service is subject to inspection; warranty may be
            declined if violations are found.
          </li>
          <li>
            A service form copy must be presented upon collection; all devices
            may be opened for inspection.
          </li>
          <li>
            For Out-of-Warranty quotes, 50 % deposit is required; valid 7 days.
          </li>
          <li>
            Units not collected within 30 days of notification or 90 days of
            drop-off may be forfeited.
          </li>
          <li>Data loss responsibility lies with the customer.</li>
          <li>Estimated repair time 3 business days – 6 weeks.</li>
          <li>
            “Find My iPhone” must be turned off. Remember your Apple ID and
            password.
          </li>
        </ul>
      </section>

      <section className="t-section t-ack">
        <p>
          I hereby confirm that I have read and agree to the terms and
          conditions stated above. I also undertake to pay the examination fee
          if the device does not meet the service conditions. Furthermore, I
          confirm that my personal information is accurate.
        </p>
        <div className="t-signature-grid">
          <div>
            <span>Name:</span> <span className="t-line" />
          </div>
          <div>
            <span>Personal ID:</span> <span className="t-line" />
          </div>
          <div>
            <span>Signature:</span> <span className="t-line" />
          </div>
        </div>
      </section>

      <footer className="t-footer">
        <a
          href="http://www.apple.com/legal/warranty"
          className="t-link"
          target="_blank"
          rel="noreferrer"
        >
          http://www.apple.com/legal/warranty
        </a>
      </footer>

      <hr className="t-break" />

      {/* ---------- Arabic Section ---------- */}
      <section className="t-section t-ar" dir="rtl">
        <header className="t-header ar">
          <h1>الشروط والأحكام</h1>
        </header>

        <p>المنتجات المدعومة</p>
        <p>
          جميع أجهزة كمبيوتر Apple و iPad و iPod و Apple Watch و إكسسوارات Apple
          و iPhone (تحت تغطية شركة Apple Inc.)
        </p>

        <p>خدماتنا</p>
        <p>
          استعادة البرمجيات، التشخيص، الإصلاحات تحت الضمان وخارج الضمان، وغير
          ذلك.
        </p>

        <p>رسوم التشخيص (15 دينار) في الحالات التالية:</p>
        <ul>
          <li>الأجهزة خارج الضمان التي تم رفض عروض أسعارها.</li>
          <li>
            الأجهزة ضمن الضمان المتضررة بسائل/حادث أو التي تم فتحها أو إصلاحها
            من قبل جهات غير معتمدة.
          </li>
        </ul>

        <h2>ما الذي يشمله الضمان؟</h2>
        <p>
          تضمن Apple المنتجات والأجزاء الأصلية في العبوة ضد عيوب المواد والتصنيع
          لمدة سنة من تاريخ الشراء.
        </p>

        <h2>ما الذي لا يشمله الضمان؟</h2>
        <p>
          لا ينطبق الضمان على أي أجهزة أو برامج غير تابعة لـ Apple حتى ولو كانت
          مرفقة أو مباعة معها.
        </p>
        <ol>
          <li>
            الأجزاء القابلة للاستهلاك (مثل البطاريات) إلا إذا كان الخلل ناجمًا
            عن عيب.
          </li>
          <li>الأضرار الشكلية مثل الخدوش أو الكسر.</li>
          <li>الأضرار الناتجة عن الاستخدام مع منتج آخر.</li>
          <li>الأضرار الناتجة عن الحوادث أو السوائل أو الحرائق أو الزلازل.</li>
          <li>الخدمة لدى جهات غير معتمدة أو باستخدام قطع غير أصلية.</li>
          <li>تعديل المنتج دون إذن كتابي من Apple.</li>
          <li>العيوب الناتجة عن البلى الطبيعي.</li>
        </ol>

        <h2>خدمة خارج الضمان</h2>
        <p>
          تُقدّم الخدمة على نفقة العميل بعد انتهاء الضمان وتُحتسب رسوم تشخيص في
          حال الرفض.
        </p>

        <h2>الإكسسوارات</h2>
        <p>
          لا تُقبل الإكسسوارات غير المتعلقة بالإصلاح (كالأغطية والحقائب) ولا
          نتحمل مسؤولية فقدانها أو تلفها.
        </p>

        <h2>مسؤوليات العميل والبيانات</h2>
        <p>
          قد يُطلب إثبات الشراء والإجابة على الأسئلة التشخيصية واتباع إجراءات
          Apple. انسخ بياناتك احتياطيًا وأزل معلوماتك الشخصية وعطّل كلمات المرور
          قبل التسليم.
        </p>

        <section className="t-section t-ack">
          <p>
            أقرّ بأنني قرأت وأوافق على الشروط والأحكام أعلاه، وأتعهد بدفع رسوم
            الفحص إذا لم يستوفِ الجهاز شروط الخدمة، كما أؤكد صحة بياناتي
            الشخصية.
          </p>
          <div className="t-signature-grid">
            <div>
              <span>الاسم:</span> <span className="t-line" />
            </div>
            <div>
              <span>رقم الهوية:</span> <span className="t-line" />
            </div>
            <div>
              <span>التوقيع:</span> <span className="t-line" />
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
