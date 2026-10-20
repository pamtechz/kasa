import Link from 'next/link';
import {ShieldCheck, CheckCircle2, AlertTriangle, FileText, ArrowLeft, Building2, Calendar, User, GraduationCap} from 'lucide-react';
import {SiteChrome, PageIntro} from '@/components/SiteChrome';
import {db} from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export default async function VerifyReferencePage({params}: {params: Promise<{reference: string}>}) {
  const {reference} = await params;
  const cleanRef = String(reference || '').trim().toUpperCase();

  let record: any = null;
  let errorMsg = '';

  try {
    const snap = await db.collection('submissions').where('reference', '==', cleanRef).limit(1).get();
    if (snap.empty) {
      errorMsg = `No official record found matching reference number "${cleanRef}". Please check the offer document and try again.`;
    } else {
      record = snap.docs[0].data();
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Verification lookup error.';
  }

  const answers = record?.answers || {};
  const studentName = String(answers['full-name'] || answers['student-name'] || answers['fullNames'] || 'Applicant');
  const programmeTitle = String(answers['programme-pathway'] || answers['preferred-programme'] || answers['program'] || record?.formTitle || 'General Agriculture');

  return (
    <SiteChrome>
      <main style={{background: '#f4f8f6', minHeight: '80vh', padding: '40px 20px'}}>
        <div style={{maxWidth: 720, margin: '0 auto'}}>
          <Link href="/" className="text-link" style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20}}>
            <ArrowLeft size={16} /> Back to KASA Portal
          </Link>

          {record ? (
            <div className="site-card" style={{padding: 32, background: '#ffffff', borderRadius: 16, border: '2px solid var(--green)', boxShadow: '0 10px 30px rgba(16,63,44,0.08)'}}>
              <div style={{textAlign: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)'}}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,63,44,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                  color: 'var(--green)'
                }}>
                  <ShieldCheck size={36} />
                </div>
                <span className="tag tag-green" style={{fontSize: 12, padding: '4px 12px', marginBottom: 8}}>
                  AUTHENTICATED DOCUMENT
                </span>
                <h1 style={{fontSize: 24, margin: '8px 0 4px', color: 'var(--ink)'}}>Official Document Verification</h1>
                <p className="muted" style={{fontSize: 14, margin: 0}}>
                  KASA Institutional Document Authenticator
                </p>
              </div>

              <div style={{background: '#f8faf9', padding: 20, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--green)'}}>
                  <CheckCircle2 size={20} />
                  <strong style={{fontSize: 15}}>Verification Confirmed</strong>
                </div>
                <p style={{margin: 0, fontSize: 13, lineHeight: 1.6, color: '#334155'}}>
                  This official verification record confirms that admission offer <strong>{cleanRef}</strong> presented to your Constituency Development Fund (CDF) Committee / Municipal Council is authentic and recognized by the KASA Directorate.
                </p>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28}}>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: 8}}>
                  <span className="muted" style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: 6}}>
                    <FileText size={15} /> Reference Number:
                  </span>
                  <strong style={{fontSize: 14, color: 'var(--green)'}}>{cleanRef}</strong>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: 8}}>
                  <span className="muted" style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: 6}}>
                    <User size={15} /> Student Full Name:
                  </span>
                  <strong style={{fontSize: 14}}>{studentName}</strong>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: 8}}>
                  <span className="muted" style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: 6}}>
                    <GraduationCap size={15} /> Programme Offered:
                  </span>
                  <strong style={{fontSize: 14, textAlign: 'right'}}>{programmeTitle}</strong>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: 8}}>
                  <span className="muted" style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: 6}}>
                    <Building2 size={15} /> Sponsorship Pathway:
                  </span>
                  <strong style={{fontSize: 14}}>
                    {record.fundingMethod === 'cdf' ? 'Constituency Development Fund (CDF)' : 'Self-Funded / Private'}
                  </strong>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: 8}}>
                  <span className="muted" style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: 6}}>
                    <Calendar size={15} /> Issue / Submitted Date:
                  </span>
                  <strong style={{fontSize: 14}}>
                    {new Date(record.submittedAt || Date.now()).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </strong>
                </div>
              </div>

              <div style={{textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12}}>
                Kamaila Academics, Sports & Apprenticeship (KASA)  ·  Admissions & Verification Directorate
              </div>
            </div>
          ) : (
            <div className="site-card" style={{padding: 32, background: '#ffffff', borderRadius: 16, border: '2px solid #ef4444', textAlign: 'center'}}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                color: '#ef4444'
              }}>
                <AlertTriangle size={36} />
              </div>
              <span className="tag tag-red" style={{fontSize: 12, padding: '4px 12px', marginBottom: 8}}>
                RECORD NOT FOUND
              </span>
              <h1 style={{fontSize: 22, margin: '8px 0 12px', color: '#1c2826'}}>Unverified Document Reference</h1>
              <p style={{fontSize: 14, lineHeight: 1.6, color: '#475569', marginBottom: 24}}>
                {errorMsg}
              </p>
              <Link href="/" className="btn btn-primary">
                Return to KASA Homepage
              </Link>
            </div>
          )}
        </div>
      </main>
    </SiteChrome>
  );
}
