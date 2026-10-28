import {db} from './_firebase.mjs';

const studentEnrollmentSchema = {
  slug: 'student-enrollment',
  title: 'KASA 2027 Student Enrollment Application',
  subtitle: 'Kamaila Academics, Sports & Apprenticeship (KASA) — Head · Heart · Hand. Applications open for 2027 programmes at Kamaila Campus, Chisamba.',
  kind: 'student',
  published: true,
  version: 2,
  sections: [
    {
      id: 'personal-identity',
      title: 'Applicant Identity & Personal Information',
      description: 'Provide your official personal details as they appear on your National Registration Card or passport.',
      fields: [
        {
          id: 'full-name',
          label: 'Full legal name',
          type: 'text',
          required: true,
          placeholder: 'e.g. Mutale Mwape'
        },
        {
          id: 'nrc-number',
          label: 'NRC / Passport number',
          type: 'text',
          required: true,
          placeholder: 'e.g. 123456/10/1'
        },
        {
          id: 'gender',
          label: 'Gender',
          type: 'radio',
          required: true,
          options: ['Male', 'Female']
        },
        {
          id: 'date-of-birth',
          label: 'Date of birth',
          type: 'date',
          required: true
        },
        {
          id: 'email',
          label: 'Email address',
          type: 'email',
          required: true,
          placeholder: 'applicant@example.com'
        },
        {
          id: 'phone',
          label: 'Phone or WhatsApp number',
          type: 'tel',
          required: true,
          placeholder: '+260 97X XXX XXX'
        },
        {
          id: 'province',
          label: 'Province of residence',
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
          id: 'district',
          label: 'District',
          type: 'text',
          required: true,
          placeholder: 'e.g. Chisamba or Lusaka'
        },
        {
          id: 'constituency',
          label: 'Constituency',
          type: 'text',
          required: true,
          placeholder: 'e.g. Chisamba or Munali'
        },
        {
          id: 'ward',
          label: 'Ward / Village',
          type: 'text',
          required: true,
          placeholder: 'e.g. Kamaila Ward'
        },
        {
          id: 'passport-photo',
          label: 'Applicant passport photograph',
          type: 'image',
          required: true,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it.'
        }
      ]
    },
    {
      id: 'programme-training',
      title: 'Programme Pathway & Training Selection',
      description: 'Select your preferred 2027 intake and training pathway (AGRI-SPORT, General Agriculture TEVETA-examined, or short courses).',
      fields: [
        {
          id: 'intake',
          label: 'Preferred intake window',
          type: 'select',
          required: true,
          optionsSource: 'intakes'
        },
        {
          id: 'programme-pathway',
          label: 'Training programme option',
          type: 'select',
          required: true,
          options: [
            'General Agriculture (TEVETA Level II Trade Certificate - 6 Months / 740 hrs - Tuition K8,200)',
            'General Agriculture (TEVETA Level III Trade Certificate - 3 Months - Tuition K4,800)',
            'AGRI-SPORT Comprehensive Programme - KASA Examined (6 Months - Tuition K8,000)',
            'AGRI-SPORT Foundational Programme - KASA Examined (3 Months - Tuition K4,700)',
            'AGRI-SPORT Short Course: Crop Production - Maize, Wheat, Soyabeans (8 Weeks - Tuition K2,600)',
            'AGRI-SPORT Short Course: Gardening & Irrigation (8 Weeks - Tuition K3,000)',
            'AGRI-SPORT Short Course: Poultry - Broilers, Layers, Village Chickens (8 Weeks - Tuition K2,600)',
            'AGRI-SPORT Short Course: Livestock - Goat, Beef & Dairy Management (8 Weeks - Tuition K3,000)',
            'AGRI-SPORT Short Course: Fish Farming & Aquaculture (8 Weeks - Tuition K3,100)',
            'AGRI-SPORT Short Course: Pasture & Feed Production (8 Weeks - Tuition K2,500)',
            'AGRI-SPORT Short Course: Cooperative Management & Enterprise (8 Weeks - Tuition K3,500)'
          ]
        },
        {
          id: 'package-option',
          label: 'Accommodation & boarding package preference',
          type: 'radio',
          required: true,
          description: 'Official 2027 fee options: Optional Accommodation K1,500 - K3,000; Optional Food K2,000 - K6,000.',
          options: [
            'Day Scholar: Tuition Only (No Food and Accommodation)',
            'Boarding Option A: Tuition + Bed Space (Accommodation Included)',
            'Full Programme Package: Tuition + Bed Space + Food'
          ]
        },
        {
          id: 'education-level',
          label: 'Highest education qualification',
          type: 'select',
          required: true,
          description: 'Minimum entry requirements: Grade 7, Grade 9, Grade 12 or Recognition of Prior Learning (RPL) / mature age entry.',
          options: [
            'Grade 7 School Leaver',
            'Grade 9 Certificate',
            'Grade 12 (GCE / School Certificate)',
            'Recognition of Prior Learning (RPL) / Mature Age Entry',
            'Tertiary Certificate, Diploma or Degree'
          ]
        }
      ]
    },
    {
      id: 'funding-declaration',
      title: 'Funding, Identification & Institutional Agreement',
      description: 'Declare your funding method, upload identity confirmation, and agree to KASA standards.',
      fields: [
        {
          id: 'funding-pathway',
          label: 'Funding / sponsorship method',
          type: 'radio',
          required: true,
          options: [
            'Self-Funded / Family Sponsorship',
            'Constituency Development Fund (CDF) Bursary Application',
            'Cooperative / Employer / Community Backing'
          ]
        },
        {
          id: 'nrc-scan',
          label: 'Scanned copy of NRC or identity document',
          type: 'image',
          required: true,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it.'
        },
        {
          id: 'medical-note',
          label: 'Any medical conditions or physical considerations for practical farm / sports work?',
          type: 'textarea',
          required: false,
          placeholder: 'List any allergies, dietary needs, or physical accommodations required for practical fieldwork.'
        },
        {
          id: 'declaration-consent',
          label: 'I declare that the information provided is correct and agree to the KASA Head · Heart · Hand training ethos. I understand that admission is subject to KASA verification and fees follow the approved 2027 schedule.',
          type: 'radio',
          required: true,
          options: ['I agree and declare']
        }
      ]
    }
  ]
};

const agentRecruitmentSchema = {
  slug: 'district-agent-recruitment',
  title: 'KASA District Enrollment Agent Application',
  subtitle: 'Join KASA\'s nationwide community recruitment network (Head · Heart · Hand). Represent KASA in your district and earn verified commissions for each enrolled student.',
  kind: 'agent',
  published: true,
  version: 2,
  sections: [
    {
      id: 'agent-identity',
      title: 'Agent Identity & Operational Jurisdiction',
      description: 'Provide your personal and contact details for agent accreditation.',
      fields: [
        {
          id: 'full-name',
          label: 'Full legal name',
          type: 'text',
          required: true,
          placeholder: 'e.g. Josephine Tembo'
        },
        {
          id: 'nrc-number',
          label: 'National Registration Card (NRC) number',
          type: 'text',
          required: true,
          placeholder: 'e.g. 291845/10/1'
        },
        {
          id: 'agent-photo',
          label: 'Agent passport photograph',
          type: 'image',
          required: true,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it.'
        },
        {
          id: 'email',
          label: 'Email address',
          type: 'email',
          required: true,
          placeholder: 'agent@example.com'
        },
        {
          id: 'phone',
          label: 'Phone or WhatsApp number',
          type: 'tel',
          required: true,
          placeholder: '+260 97X XXX XXX'
        },
        {
          id: 'province',
          label: 'Target province of recruitment',
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
          id: 'district',
          label: 'Target district',
          type: 'text',
          required: true,
          placeholder: 'e.g. Lusaka, Chisamba, Kabwe, Ndola'
        },
        {
          id: 'constituency',
          label: 'Target constituency',
          type: 'text',
          required: true,
          placeholder: 'e.g. Munali, Chisamba, Mandevu'
        },
        {
          id: 'ward',
          label: 'Target ward / community',
          type: 'text',
          required: true,
          placeholder: 'e.g. Ward 15'
        }
      ]
    },
    {
      id: 'qualifications-mobilization',
      title: 'Qualifications, Community Mobilization & Equipment',
      description: 'Tell us about your community ties, mobilization background and communication capabilities.',
      fields: [
        {
          id: 'qualification',
          label: 'Highest academic qualification',
          type: 'select',
          required: true,
          options: ['Grade 9', 'Grade 12', 'Certificate', 'Diploma', 'Degree', 'Other']
        },
        {
          id: 'outreach-experience',
          label: 'Community outreach and student mobilization experience',
          type: 'textarea',
          required: true,
          placeholder: 'Describe your experience working with youth, churches, agricultural cooperatives, schools, or community mobilization.'
        },
        {
          id: 'smartphone-access',
          label: 'Do you own an active smartphone with WhatsApp and internet connectivity?',
          type: 'radio',
          required: true,
          options: ['Yes', 'No']
        },
        {
          id: 'availability',
          label: 'Availability for field mobilization',
          type: 'radio',
          required: true,
          options: ['Full-time', 'Part-time', 'Weekends only']
        },
        {
          id: 'nrc-scan',
          label: 'Scanned copy of NRC (front and back)',
          type: 'image',
          required: true,
          description: 'Choose a JPG or PNG image from your device and authorize your external storage to upload it.'
        }
      ]
    },
    {
      id: 'compliance-declaration',
      title: 'Ethics, CDF Anti-Bribery Compliance & Commission Terms',
      description: 'Strict adherence to Zambian laws, anti-bribery regulations, and KASA professional code of conduct is mandatory.',
      fields: [
        {
          id: 'anti-bribery-compliance',
          label: 'I understand and agree that CDF application forms are 100% FREE by Zambian law. I will NEVER charge applicants or parents for CDF forms, nor guarantee bursary approval or admission.',
          type: 'radio',
          required: true,
          options: ['I strictly agree and comply']
        },
        {
          id: 'commission-terms',
          label: 'I understand that agent commission is paid strictly upon verified paid enrollment or official confirmed CDF bursary sponsorship approval by KASA.',
          type: 'radio',
          required: true,
          options: ['I understand and agree']
        },
        {
          id: 'declaration-code-of-conduct',
          label: 'I declare that all information provided is accurate and I agree to represent KASA with professional excellence and moral integrity under the Head · Heart · Hand values.',
          type: 'radio',
          required: true,
          options: ['I declare and agree']
        }
      ]
    }
  ]
};

async function seedForms() {
  console.log('Seeding official KASA 2027 forms into Firestore...');
  const now = new Date().toISOString();

  // 1. Seed or Update student-enrollment form
  const studentQuery = await db.collection('forms').where('slug', '==', 'student-enrollment').limit(1).get();
  let studentFormId = '';
  if (!studentQuery.empty) {
    studentFormId = studentQuery.docs[0].id;
    await db.collection('forms').doc(studentFormId).update({
      ...studentEnrollmentSchema,
      updatedAt: now
    });
    console.log(`Updated published student-enrollment form (${studentFormId})`);
  } else {
    const docRef = await db.collection('forms').add({
      ...studentEnrollmentSchema,
      createdAt: now,
      updatedAt: now
    });
    studentFormId = docRef.id;
    console.log(`Created published student-enrollment form (${studentFormId})`);
  }

  // 2. Seed or Update district-agent-recruitment form
  const agentQuery = await db.collection('forms').where('slug', '==', 'district-agent-recruitment').limit(1).get();
  let agentFormId = '';
  if (!agentQuery.empty) {
    agentFormId = agentQuery.docs[0].id;
    await db.collection('forms').doc(agentFormId).update({
      ...agentRecruitmentSchema,
      updatedAt: now
    });
    console.log(`Updated published district-agent-recruitment form (${agentFormId})`);
  } else {
    const docRef = await db.collection('forms').add({
      ...agentRecruitmentSchema,
      createdAt: now,
      updatedAt: now
    });
    agentFormId = docRef.id;
    console.log(`Created published district-agent-recruitment form (${agentFormId})`);
  }

  // 3. Seed Realistic Sample Submissions using attached data and Cloudinary image assets
  console.log('Seeding sample submissions into Firestore...');
  const sampleSubmissions = [
    {
      id: 'sub-2027-student-mutale',
      reference: 'KASA-2027-ENR001',
      formId: studentFormId,
      formTitle: studentEnrollmentSchema.title,
      formKind: 'student',
      formVersion: studentEnrollmentSchema.version,
      status: 'accepted',
      answers: {
        'full-name': 'Mutale Mwape',
        'nrc-number': '348219/11/1',
        gender: 'Male',
        'date-of-birth': '2004-05-14',
        email: 'mutale.mwape@example.com',
        phone: '+260 977 123 456',
        province: 'Central Province',
        district: 'Chisamba',
        constituency: 'Chisamba',
        ward: 'Kamaila Farming Block',
        'passport-photo': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/mutale-mwape-passport.jpg',
        intake: '2027 January Intake',
        'programme-pathway': 'General Agriculture (TEVETA Level II Trade Certificate - 6 Months / 740 hrs - Tuition K8,200)',
        'package-option': 'Full Programme Package: Tuition + Bed Space + Food',
        'education-level': 'Grade 12 (GCE / School Certificate)',
        'funding-pathway': 'Constituency Development Fund (CDF) Bursary Application',
        'nrc-scan': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/mutale-mwape-nrc.jpg',
        'medical-note': 'None. Fit and eager for practical farming operations and machinery.',
        'declaration-consent': 'I agree and declare'
      },
      agentId: null,
      applicantUid: null,
      formSnapshot: {
        title: studentEnrollmentSchema.title,
        slug: studentEnrollmentSchema.slug,
        sections: studentEnrollmentSchema.sections,
        version: studentEnrollmentSchema.version
      },
      submittedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      history: [
        {at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), status: 'submitted', by: 'applicant'},
        {at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), status: 'under_review', by: 'staff'},
        {at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), status: 'accepted', by: 'staff'}
      ]
    },
    {
      id: 'sub-2027-student-chileshe',
      reference: 'KASA-2027-ENR002',
      formId: studentFormId,
      formTitle: studentEnrollmentSchema.title,
      formKind: 'student',
      formVersion: studentEnrollmentSchema.version,
      status: 'under_review',
      answers: {
        'full-name': 'Chileshe Banda',
        'nrc-number': '491028/67/1',
        gender: 'Female',
        'date-of-birth': '2005-08-22',
        email: 'chileshe.banda@example.com',
        phone: '+260 966 789 012',
        province: 'Lusaka Province',
        district: 'Lusaka',
        constituency: 'Munali',
        ward: 'Chainda',
        'passport-photo': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/chileshe-banda-passport.jpg',
        intake: '2027 January Intake',
        'programme-pathway': 'AGRI-SPORT Comprehensive Programme - KASA Examined (6 Months - Tuition K8,000)',
        'package-option': 'Boarding Option A: Tuition + Bed Space (Accommodation Included)',
        'education-level': 'Grade 12 (GCE / School Certificate)',
        'funding-pathway': 'Self-Funded / Family Sponsorship',
        'nrc-scan': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/chileshe-banda-nrc.jpg',
        'medical-note': 'Asthma under control; requires inhaler during heavy harvest season.',
        'declaration-consent': 'I agree and declare'
      },
      agentId: null,
      applicantUid: null,
      formSnapshot: {
        title: studentEnrollmentSchema.title,
        slug: studentEnrollmentSchema.slug,
        sections: studentEnrollmentSchema.sections,
        version: studentEnrollmentSchema.version
      },
      submittedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      history: [
        {at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), status: 'submitted', by: 'applicant'},
        {at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), status: 'under_review', by: 'staff'}
      ]
    },
    {
      id: 'sub-2027-student-kondwani',
      reference: 'KASA-2027-ENR003',
      formId: studentFormId,
      formTitle: studentEnrollmentSchema.title,
      formKind: 'student',
      formVersion: studentEnrollmentSchema.version,
      status: 'submitted',
      answers: {
        'full-name': 'Kondwani Phiri',
        'nrc-number': '182940/10/1',
        gender: 'Male',
        'date-of-birth': '2003-11-03',
        email: 'kondwani.phiri@example.com',
        phone: '+260 955 345 678',
        province: 'Central Province',
        district: 'Chisamba',
        constituency: 'Chisamba',
        ward: 'Chibombo Junction',
        'passport-photo': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/kondwani-phiri-passport.jpg',
        intake: '2027 January Intake',
        'programme-pathway': 'AGRI-SPORT Short Course: Fish Farming & Aquaculture (8 Weeks - Tuition K3,100)',
        'package-option': 'Day Scholar: Tuition Only (No Food and Accommodation)',
        'education-level': 'Grade 9 Certificate',
        'funding-pathway': 'Self-Funded / Family Sponsorship',
        'nrc-scan': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/kondwani-phiri-nrc.jpg',
        'medical-note': 'None. Strong swimmer, ready for fish pond construction and management.',
        'declaration-consent': 'I agree and declare'
      },
      agentId: null,
      applicantUid: null,
      formSnapshot: {
        title: studentEnrollmentSchema.title,
        slug: studentEnrollmentSchema.slug,
        sections: studentEnrollmentSchema.sections,
        version: studentEnrollmentSchema.version
      },
      submittedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      history: [
        {at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), status: 'submitted', by: 'applicant'}
      ]
    },
    {
      id: 'sub-2027-agent-josephine',
      reference: 'KASA-2027-AGT001',
      formId: agentFormId,
      formTitle: agentRecruitmentSchema.title,
      formKind: 'agent',
      formVersion: agentRecruitmentSchema.version,
      status: 'accepted',
      answers: {
        'full-name': 'Josephine Tembo',
        'nrc-number': '291845/10/1',
        'agent-photo': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/josephine-tembo-passport.jpg',
        email: 'josephine.tembo@example.com',
        phone: '+260 971 234 890',
        province: 'Lusaka Province',
        district: 'Lusaka',
        constituency: 'Munali',
        ward: 'Kaunda Square Stage 1',
        qualification: 'Diploma',
        'outreach-experience': '5 years community youth outreach in Munali Constituency, organized community agricultural cooperatives and parish skills workshops.',
        'smartphone-access': 'Yes',
        availability: 'Full-time',
        'nrc-scan': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/josephine-tembo-nrc.jpg',
        'anti-bribery-compliance': 'I strictly agree and comply',
        'commission-terms': 'I understand and agree',
        'declaration-code-of-conduct': 'I declare and agree'
      },
      agentId: null,
      applicantUid: null,
      formSnapshot: {
        title: agentRecruitmentSchema.title,
        slug: agentRecruitmentSchema.slug,
        sections: agentRecruitmentSchema.sections,
        version: agentRecruitmentSchema.version
      },
      submittedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      history: [
        {at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), status: 'submitted', by: 'applicant'},
        {at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), status: 'under_review', by: 'staff'},
        {at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), status: 'accepted', by: 'staff'}
      ]
    },
    {
      id: 'sub-2027-agent-patrick',
      reference: 'KASA-2027-AGT002',
      formId: agentFormId,
      formTitle: agentRecruitmentSchema.title,
      formKind: 'agent',
      formVersion: agentRecruitmentSchema.version,
      status: 'submitted',
      answers: {
        'full-name': 'Patrick Lungu',
        'nrc-number': '501928/65/1',
        'agent-photo': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/patrick-lungu-passport.jpg',
        email: 'patrick.lungu@example.com',
        phone: '+260 965 876 543',
        province: 'Central Province',
        district: 'Chisamba',
        constituency: 'Chisamba',
        ward: 'Kamaila Farming Block / 22 Miles',
        qualification: 'Certificate',
        'outreach-experience': 'Secretary of Kamaila Local Farmers Cooperative and youth soccer league organizer across Chisamba and Junken Road.',
        'smartphone-access': 'Yes',
        availability: 'Part-time',
        'nrc-scan': 'https://res.cloudinary.com/kasa-cloud/image/upload/v1729080000/kasa/samples/patrick-lungu-nrc.jpg',
        'anti-bribery-compliance': 'I strictly agree and comply',
        'commission-terms': 'I understand and agree',
        'declaration-code-of-conduct': 'I declare and agree'
      },
      agentId: null,
      applicantUid: null,
      formSnapshot: {
        title: agentRecruitmentSchema.title,
        slug: agentRecruitmentSchema.slug,
        sections: agentRecruitmentSchema.sections,
        version: agentRecruitmentSchema.version
      },
      submittedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      history: [
        {at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), status: 'submitted', by: 'applicant'}
      ]
    }
  ];

  for (const sub of sampleSubmissions) {
    await db.collection('submissions').doc(sub.id).set(sub);
    console.log(`Seeded submission: ${sub.reference} (${sub.answers['full-name']}) - ${sub.status}`);
  }

  console.log('Seeding completed successfully!');
}

seedForms().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
