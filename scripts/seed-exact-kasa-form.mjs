import {db} from './_firebase.mjs';

const exactKasaForm = {
  title: 'KASA Enrollment Form',
  slug: 'kasa-enrollment-form',
  subtitle: 'Complete in BLOCK CAPITALS and tick the appropriate boxes. Use N/A where a field does not apply. Submit this form to KASA for review and confirmation of your enrollment.',
  kind: 'student',
  published: true,
  version: 1,
  sections: [
    {
      id: 'sec-1-programme',
      title: '1 PROGRAMME SELECTION',
      description: 'Select your preferred training area, qualification or independent short course.',
      fields: [
        {
          id: 'programme-title',
          label: 'Programme or course title',
          type: 'select',
          required: true,
          options: [
            'General Agriculture (TEVETA Level II Trade Certificate - 6 Months)',
            'General Agriculture (TEVETA Level III Trade Certificate - 3 Months)',
            'General Agriculture (TEVETA Level I Trade Certificate - 12 Months)',
            'AGRI-SPORT Comprehensive Programme (6 Months)',
            'AGRI-SPORT Foundational Programme (3 Months)',
            'Sports Development Programme (6 Months)',
            'Cooperative Development (6 Months)',
            'Short Course: Crop Production (8 Weeks)',
            'Short Course: Horticulture (8 Weeks)',
            'Short Course: Irrigation (6 Weeks)',
            'Short Course: Poultry (6 Weeks)',
            'Short Course: Livestock (8 Weeks)',
            'Short Course: Fish Farming (8 Weeks)',
            'Short Course: Pasture and Feed Production (6 Weeks)',
            'Short Course: Football Coaching (6 Weeks)',
            'Short Course: Athletics Coaching (6 Weeks)',
            'Short Course: Sports/Athletics Personnel (4 Weeks)'
          ]
        },
        {
          id: 'training-area',
          label: 'Training area',
          type: 'radio',
          required: true,
          options: ['General Agriculture', 'Sports', 'Cooperative Development', 'Short Course']
        },
        {
          id: 'short-course-specify',
          label: 'Short Course Please specify (if applicable)',
          type: 'text',
          required: false,
          placeholder: 'e.g. Poultry, Horticulture, or Football Coaching'
        },
        {
          id: 'sports-focus',
          label: 'Sports focus if applicable',
          type: 'radio',
          required: false,
          options: ['Football coaching', 'Athletics coaching', 'Both', 'Sports/Athletics Personnel']
        },
        {
          id: 'agriculture-interests',
          label: 'Agriculture interests if applicable',
          type: 'checkbox',
          required: false,
          options: [
            'Crop production',
            'Horticulture',
            'Irrigation',
            'Poultry',
            'Livestock',
            'Fish farming',
            'Pasture and feed production',
            'Other'
          ]
        },
        {
          id: 'intake',
          label: 'Preferred intake',
          type: 'radio',
          required: true,
          options: ['January', 'July']
        }
      ]
    },
    {
      id: 'sec-2-applicant',
      title: '2 APPLICANT DETAILS',
      description: 'Official identity and contact information.',
      fields: [
        {
          id: 'full-name',
          label: 'Full names',
          type: 'text',
          required: true,
          placeholder: 'e.g. Mwape Chanda'
        },
        {
          id: 'date-of-birth',
          label: 'Date of birth',
          type: 'date',
          required: true
        },
        {
          id: 'gender',
          label: 'Gender',
          type: 'radio',
          required: true,
          options: ['Male', 'Female']
        },
        {
          id: 'nationality',
          label: 'Nationality',
          type: 'text',
          required: true,
          placeholder: 'Zambian'
        },
        {
          id: 'nrc-number',
          label: 'NRC or passport number if available',
          type: 'text',
          required: false,
          placeholder: 'e.g. 123456/10/1'
        },
        {
          id: 'phone',
          label: 'Mobile number',
          type: 'tel',
          required: true,
          placeholder: '+260 97X XXX XXX'
        },
        {
          id: 'whatsapp-number',
          label: 'WhatsApp number',
          type: 'tel',
          required: false,
          placeholder: '+260 97X XXX XXX'
        },
        {
          id: 'email',
          label: 'Email address if available',
          type: 'email',
          required: false,
          placeholder: 'applicant@example.com'
        },
        {
          id: 'residential-address',
          label: 'Residential address or village',
          type: 'text',
          required: true,
          placeholder: 'Village / Farm / Street address'
        },
        {
          id: 'district',
          label: 'District',
          type: 'text',
          required: true,
          placeholder: 'e.g. Chisamba, Lusaka, or Chibombo'
        },
        {
          id: 'province',
          label: 'Province',
          type: 'select',
          required: true,
          options: [
            'Central Province',
            'Copperbelt Province',
            'Eastern Province',
            'Luapula Province',
            'Lusaka Province',
            'Muchinga Province',
            'Northern Province',
            'North-Western Province',
            'Southern Province',
            'Western Province'
          ]
        },
        {
          id: 'postal-address',
          label: 'Postal address if different',
          type: 'text',
          required: false,
          placeholder: 'P.O. Box...'
        }
      ]
    },
    {
      id: 'sec-3-education',
      title: '3 EDUCATION AND PRACTICAL EXPERIENCE',
      description: 'Prior schooling and background.',
      fields: [
        {
          id: 'highest-qualification',
          label: 'Highest grade or qualification completed',
          type: 'select',
          required: true,
          options: [
            'Grade 7',
            'Grade 9',
            'Grade 12 (GCE / School Certificate)',
            'Certificate',
            'Diploma',
            'Degree',
            'Recognition of Prior Learning / Other'
          ]
        },
        {
          id: 'school-institution',
          label: 'School or training institution',
          type: 'text',
          required: false,
          placeholder: 'Name of school attended'
        },
        {
          id: 'completion-year',
          label: 'Year completed',
          type: 'number',
          required: false,
          placeholder: 'e.g. 2024'
        },
        {
          id: 'current-status',
          label: 'Current status',
          type: 'radio',
          required: true,
          options: ['Student', 'Employed', 'Self employed', 'Seeking work']
        },
        {
          id: 'occupation',
          label: 'Occupation (optional)',
          type: 'text',
          required: false
        },
        {
          id: 'previous-training',
          label: 'Previous training or experience related to this course',
          type: 'textarea',
          required: false,
          placeholder: 'Describe any practical agricultural, sports or hands-on experience.'
        }
      ]
    },
    {
      id: 'sec-4-guardian',
      title: '4 PARENT OR GUARDIAN AND EMERGENCY CONTACT',
      description: 'Guardian details for applicants under 18, and designated emergency contact for all applicants.',
      fields: [
        {
          id: 'guardian-name',
          label: 'Parent or Guardian: Full name',
          type: 'text',
          required: false,
          placeholder: 'Complete for applicants under 18 or where guardian is involved'
        },
        {
          id: 'guardian-relationship',
          label: 'Relationship to applicant',
          type: 'text',
          required: false,
          placeholder: 'e.g. Father, Mother, Uncle'
        },
        {
          id: 'guardian-phone',
          label: 'Parent or Guardian: Mobile number',
          type: 'tel',
          required: false
        },
        {
          id: 'guardian-address',
          label: 'Parent or Guardian: Residential address',
          type: 'text',
          required: false
        },
        {
          id: 'guardian-is-emergency',
          label: 'If the guardian is also the emergency contact, tick here',
          type: 'radio',
          required: false,
          options: ['Yes', 'No - Different emergency contact']
        },
        {
          id: 'emergency-name',
          label: 'Emergency Contact: Full name',
          type: 'text',
          required: true,
          placeholder: 'Primary contact in case of emergency'
        },
        {
          id: 'emergency-relationship',
          label: 'Emergency Contact: Relationship',
          type: 'text',
          required: true,
          placeholder: 'e.g. Brother, Parent, Neighbor'
        },
        {
          id: 'emergency-phone',
          label: 'Emergency Contact: Mobile number',
          type: 'tel',
          required: true
        },
        {
          id: 'emergency-alt-phone',
          label: 'Alternative contact number if available',
          type: 'tel',
          required: false
        }
      ]
    },
    {
      id: 'sec-5-support',
      title: '5 LEARNING AND PRACTICAL TRAINING SUPPORT',
      description: 'Safe participation, health needs or learning adjustments.',
      fields: [
        {
          id: 'learning-support',
          label: 'Do you need learning or access support?',
          type: 'radio',
          required: true,
          options: ['Yes', 'No', 'Discuss privately']
        },
        {
          id: 'adjustments-needed',
          label: 'Support or adjustments needed',
          type: 'textarea',
          required: false,
          placeholder: 'List any reading, writing or mobility accommodations.'
        },
        {
          id: 'health-needs',
          label: 'Health needs affecting participation',
          type: 'radio',
          required: true,
          options: ['None to report', 'Details below', 'Discuss privately']
        },
        {
          id: 'allergies-emergency-instructions',
          label: 'Relevant condition allergies or emergency instructions',
          type: 'textarea',
          required: false,
          placeholder: 'List any severe allergies, asthma, dietary conditions or special medical notes.'
        }
      ]
    },
    {
      id: 'sec-6-funding',
      title: '6 FUNDING ARRANGEMENTS',
      description: 'Select how your fees will be paid. Selecting CDF sponsorship automatically approves your admission for fast-tracked bursary processing.',
      fields: [
        {
          id: 'fees-paid-by',
          label: 'Fees paid by',
          type: 'radio',
          required: true,
          options: ['Self', 'Parent or guardian', 'Employer', 'Sponsor', 'CDF']
        },
        {
          id: 'seeking-assistance',
          label: 'Seeking financial assistance',
          type: 'radio',
          required: false,
          options: ['Yes', 'No']
        },
        {
          id: 'assistance-details',
          label: 'Details if applicable',
          type: 'textarea',
          required: false,
          placeholder: 'Specify Constituency name for CDF, or sponsor organization.'
        },
        {
          id: 'payer-name',
          label: 'Payer or sponsor name',
          type: 'text',
          required: false,
          placeholder: 'Name of sponsor, company or CDF Committee'
        },
        {
          id: 'payer-phone',
          label: 'Payer or sponsor phone',
          type: 'tel',
          required: false
        }
      ]
    },
    {
      id: 'sec-7-documents',
      title: '7 SUPPORTING DOCUMENTS',
      description: 'Tick documents submitted where applicable. KASA will confirm which documents your chosen programme requires. NOTE: CDF documents are NOT required upfront to submit your application.',
      fields: [
        {
          id: 'documents-submitted-tick',
          label: 'Tick documents submitted where applicable',
          type: 'checkbox',
          required: false,
          options: [
            'NRC/Passport',
            'School results or qualification',
            'Sponsorship letter',
            'Photograph if requested',
            'Other'
          ]
        },
        {
          id: 'passport-photo',
          label: 'Applicant photograph',
          type: 'image',
          required: false,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it.'
        },
        {
          id: 'identity-document-url',
          label: 'NRC / Identity document image (optional)',
          type: 'image',
          required: false,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it. You can also present original NRC upon reporting.'
        }
      ]
    },
    {
      id: 'sec-8-declaration',
      title: '8 DECLARATION AND CONSENT',
      description: 'Confirm accuracy and agree to KASA safety and training rules.',
      fields: [
        {
          id: 'declaration-consent',
          label: 'I confirm that the information provided is accurate to the best of my knowledge. If admitted, I will follow attendance requirements, conduct rules and safety instructions explained by KASA. I will use required protective equipment and report unsafe conditions. I permit KASA to use the information in this form to process my application.',
          type: 'radio',
          required: true,
          options: ['I agree and confirm']
        },
        {
          id: 'photographs-publicity',
          label: 'OPTIONAL PHOTOGRAPHS AND PUBLICITY: I agree to KASA using photographs or videos that identify me in its publicity. Choosing No does not affect enrollment.',
          type: 'radio',
          required: true,
          options: ['Yes', 'No']
        },
        {
          id: 'applicant-signature-name',
          label: 'Applicant signature (Type your full legal name)',
          type: 'text',
          required: true,
          placeholder: 'Your full legal name as digital signature'
        },
        {
          id: 'declaration-date',
          label: 'Date',
          type: 'date',
          required: true
        },
        {
          id: 'parent-guardian-approval',
          label: 'PARENT OR GUARDIAN APPROVAL FOR APPLICANTS UNDER 18: Parent/guardian consent to the applicant enrolling in the selected programme and taking part in its supervised training activities.',
          type: 'text',
          required: false,
          placeholder: 'Guardian full name (if applicant is under 18)'
        }
      ]
    }
  ]
};

const now = new Date().toISOString();

// 1. Seed into kasa-enrollment-form
const snapKasa = await db.collection('forms').where('slug', '==', 'kasa-enrollment-form').limit(1).get();
if (snapKasa.empty) {
  await db.collection('forms').add({
    ...exactKasaForm,
    createdAt: now,
    updatedAt: now
  });
  console.log('Seeded kasa-enrollment-form into Firestore');
} else {
  await snapKasa.docs[0].ref.set({
    ...exactKasaForm,
    updatedAt: now
  }, {merge: true});
  console.log('Updated existing kasa-enrollment-form in Firestore');
}

// 2. Also update student-enrollment with this official 9-section structure
const snapStudent = await db.collection('forms').where('slug', '==', 'student-enrollment').limit(1).get();
if (!snapStudent.empty) {
  await snapStudent.docs[0].ref.set({
    ...exactKasaForm,
    slug: 'student-enrollment',
    title: 'KASA Student Enrollment Application',
    updatedAt: now
  }, {merge: true});
  console.log('Updated student-enrollment form in Firestore with exact 9-section template');
}

console.log('Exact 9-section KASA Enrollment Form successfully seeded and fully editable in Form Builder!');
