import {z} from 'zod';

export const mainProgrammeFeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  duration: z.string().trim().min(1).max(60),
  fee: z.string().trim().min(1).max(60)
});

export const shortCourseFeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  duration: z.string().trim().min(1).max(60),
  fee: z.string().trim().min(1).max(60)
});

export const courseRequirementRowSchema = z.object({
  course: z.string().trim().min(2).max(120),
  requirements: z.string().trim().min(2).max(300)
});

export const enrollmentFormFieldOffsetSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  fontSize: z.number().min(6).max(24).default(9)
});

export const enrollmentFormOffsetsSchema = z.object({
  applicationDate: enrollmentFormFieldOffsetSchema.default({x: 165, y: 736, fontSize: 9}),
  intakeAndYear: enrollmentFormFieldOffsetSchema.default({x: 410, y: 736, fontSize: 9}),
  programmeTitle: enrollmentFormFieldOffsetSchema.default({x: 175, y: 698, fontSize: 9}),
  fullNames: enrollmentFormFieldOffsetSchema.default({x: 105, y: 550, fontSize: 9}),
  dob: enrollmentFormFieldOffsetSchema.default({x: 175, y: 536, fontSize: 9}),
  gender: enrollmentFormFieldOffsetSchema.default({x: 330, y: 536, fontSize: 9}),
  nationality: enrollmentFormFieldOffsetSchema.default({x: 105, y: 522, fontSize: 9}),
  nrcNumber: enrollmentFormFieldOffsetSchema.default({x: 380, y: 522, fontSize: 9}),
  mobileNumber: enrollmentFormFieldOffsetSchema.default({x: 125, y: 508, fontSize: 9}),
  whatsappNumber: enrollmentFormFieldOffsetSchema.default({x: 350, y: 508, fontSize: 9}),
  email: enrollmentFormFieldOffsetSchema.default({x: 175, y: 494, fontSize: 9}),
  residentialAddress: enrollmentFormFieldOffsetSchema.default({x: 195, y: 480, fontSize: 9}),
  district: enrollmentFormFieldOffsetSchema.default({x: 85, y: 466, fontSize: 9}),
  province: enrollmentFormFieldOffsetSchema.default({x: 300, y: 466, fontSize: 9}),
  highestGrade: enrollmentFormFieldOffsetSchema.default({x: 230, y: 395, fontSize: 9}),
  schoolInstitution: enrollmentFormFieldOffsetSchema.default({x: 190, y: 381, fontSize: 9}),
  qualificationYear: enrollmentFormFieldOffsetSchema.default({x: 480, y: 381, fontSize: 9}),
  occupation: enrollmentFormFieldOffsetSchema.default({x: 160, y: 760, fontSize: 9}),
  guardianName: enrollmentFormFieldOffsetSchema.default({x: 105, y: 685, fontSize: 9}),
  guardianRelationship: enrollmentFormFieldOffsetSchema.default({x: 165, y: 672, fontSize: 9}),
  guardianMobile: enrollmentFormFieldOffsetSchema.default({x: 420, y: 672, fontSize: 9}),
  emergencyName: enrollmentFormFieldOffsetSchema.default({x: 105, y: 615, fontSize: 9}),
  emergencyMobile: enrollmentFormFieldOffsetSchema.default({x: 125, y: 602, fontSize: 9}),
  sponsorName: enrollmentFormFieldOffsetSchema.default({x: 165, y: 446, fontSize: 9}),
  declarationName: enrollmentFormFieldOffsetSchema.default({x: 175, y: 690, fontSize: 9}),
  declarationDate: enrollmentFormFieldOffsetSchema.default({x: 440, y: 690, fontSize: 9}),
  officeReference: enrollmentFormFieldOffsetSchema.default({x: 440, y: 510, fontSize: 9}),
  officeEnrollmentNum: enrollmentFormFieldOffsetSchema.default({x: 155, y: 478, fontSize: 9}),
  officeConfirmedProg: enrollmentFormFieldOffsetSchema.default({x: 380, y: 478, fontSize: 9}),
  officeIntakeDate: enrollmentFormFieldOffsetSchema.default({x: 155, y: 462, fontSize: 9})
}).default({});

export const acceptanceLetterConfigSchema = z.object({
  institution: z.object({
    name: z.string().trim().min(2).max(120).default('KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP'),
    motto: z.string().trim().max(120).default('(KASA) — HEAD | HEART | HAND'),
    lusakaAddress: z.string().trim().max(200).default('House No. 40, Civic Centre, Area 22, Lusaka, Zambia'),
    campusAddress: z.string().trim().max(250).default('Kamaila Farming Block, 22 Miles, After Protea Hotel, Junken Rd, Chisamba'),
    phone: z.string().trim().max(50).default('+260 574 203 660'),
    email: z.string().trim().email().or(z.string().trim().max(80)).default('kasa@zamfirm.com'),
    primaryColorHex: z.string().regex(/^#([A-Fa-f0-9]{6})$/).default('#103f2c'),
    goldColorHex: z.string().regex(/^#([A-Fa-f0-9]{6})$/).default('#e0b561')
  }).default({}),
  letter: z.object({
    title: z.string().trim().max(100).default('LETTER OF ACCEPTANCE'),
    salutation: z.string().trim().max(80).default('Dear Applicant,'),
    introText: z.string().trim().max(600).default(
      'We are pleased to inform you that your application to Kamaila Academics, Sports & Apprenticeship (KASA) has been accepted for the programme specified below.'
    ),
    instructionsText1: z.string().trim().max(600).default(
      'To confirm your place, complete and return the Acceptance Form on page 5 by the deadline above. Present original identification and the entry documents required for your course for verification on reporting.'
    ),
    instructionsText2: z.string().trim().max(600).default(
      "The course fee schedule is on page 2. Your approved payment dates and any cancellation or refund terms must be recorded before you confirm enrolment. CDF or other sponsorship requires the funding body's written approval."
    ),
    reportingDirections: z.string().trim().max(600).default(
      'Report to the Admissions Office at Kamaila Farming Block, 22 Miles, Chisamba. Bring this document and the personal, school and course items listed on pages 3 and 4.'
    ),
    welcomeText: z.string().trim().max(200).default('We look forward to welcoming you to KASA.'),
    closing: z.string().trim().max(100).default('Yours faithfully,'),
    signatory: z.string().trim().max(120).default('Authorised Admissions Officer'),
    signatoryTitle: z.string().trim().max(140).default('Admissions Directorate / Registrar'),
    officialStampText: z.string().trim().max(60).default('Official stamp')
  }).default({}),
  fees: z.object({
    mainProgrammes: z.array(mainProgrammeFeeSchema).default([
      {name: 'Agri-Sport Foundation or Applied', duration: '3 or 6 months', fee: 'To be confirmed'},
      {name: 'General Agriculture Trade Test Level III', duration: '3 months', fee: '4,220'},
      {name: 'General Agriculture Trade Test Level II', duration: '6 months', fee: '7,700'},
      {name: 'General Agriculture Trade Test Level I', duration: '12 months', fee: '12,550'},
      {name: 'Sports', duration: '6 months', fee: '6,900'},
      {name: 'Cooperative Development', duration: '6 months', fee: '5,500'}
    ]),
    shortCourses: z.array(shortCourseFeeSchema).default([
      {name: 'Crop Production', duration: '8 weeks', fee: '3,350'},
      {name: 'Horticulture', duration: '8 weeks', fee: '3,850'},
      {name: 'Irrigation', duration: '6 weeks', fee: '4,000'},
      {name: 'Poultry', duration: '6 weeks', fee: '3,450'},
      {name: 'Livestock', duration: '8 weeks', fee: '4,100'},
      {name: 'Fish Farming', duration: '8 weeks', fee: '4,350'},
      {name: 'Pasture and Feed Production', duration: '6 weeks', fee: '3,400'},
      {name: 'Football Coaching', duration: '6 weeks', fee: '3,400'},
      {name: 'Athletics Coaching', duration: '6 weeks', fee: '3,400'},
      {name: 'Sports/Athletics Personnel', duration: '4 weeks', fee: '2,600'}
    ]),
    hostelBedspaceMonthly: z.string().trim().default('K650 per month, optional and subject to availability.'),
    mealsMonthly: z.string().trim().default('K1,100 per month (proposed). These charges are additional to academic fees.'),
    instalmentNote: z.string().trim().max(500).default(
      'Suggested academic-fee instalments in the supplied schedule: 40% at registration, 30% mid-course and 30% before assessment, subject to approval. Hostel and meals are billed monthly.'
    )
  }).default({}),
  requirements: z.object({
    checklistA: z.array(z.string().trim()).default([
      'Completed KASA enrolment form and this acceptance document.',
      'Original NRC, passport or other accepted identification, with a copy.',
      'Original school results or qualifications and copies where required for the course.',
      'Prerequisite level results or recognised prior-learning evidence stated in the offer.',
      'Proof of agreed payment or the official CDF, bursary or other sponsorship approval.',
      'Parent or guardian consent for a minor, and current emergency contact details.',
      'Photograph only if requested by the Admissions Office.'
    ]),
    checklistB: z.array(z.string().trim()).default([
      'Notebooks or exercise books, pens and a document folder.',
      'Basic calculator; scientific calculator or mathematical set only where the course requires it.',
      'Practical logbook or field record book where directed for the programme.',
      'Reusable water bottle and suitable clothing for classes and supervised activities.'
    ]),
    checklistC: z.array(z.string().trim()).default([
      'Suitable everyday clothing and closed footwear; course workwear as listed on page 4.',
      'Towel, toiletries and other personal hygiene items.',
      'Inform the designated staff member privately about relevant support or emergency needs.'
    ]),
    checklistD: z.array(z.string().trim()).default([
      'Bedsheets, blanket and pillow.',
      'Towel, toiletries and a bathing bucket.',
      'Personal plate, cup and spoon, with the necessary personal clothing.',
      'Cooking equipment may be brought only where KASA authorises self-catering. Electrical cookers require written hostel approval.'
    ])
  }).default({}),
  courseRequirements: z.object({
    agriSportText: z.string().trim().max(600).default(
      'Washable overalls or farm clothes, suitable boots, work gloves, sun hat and water bottle; suitable football and athletics kit and trainers; notebooks, pens, calculator, document folder and practical logbook. Bring a whistle where directed by the instructor.'
    ),
    tevetaLevels: z.array(z.object({
      level: z.string(),
      items: z.string()
    })).default([
      {level: 'Level III', items: 'Notebook, pens, basic calculator, overalls, work gloves, gumboots and sun hat.'},
      {level: 'Level II', items: 'Level III items, plus a field record book and measuring tape where directed.'},
      {level: 'Level I', items: 'Level II items, plus a practical logbook and additional specialist PPE as instructed.'}
    ]),
    shortCoursesList: z.array(courseRequirementRowSchema).default([
      {course: 'Crop Production', requirements: 'Notebook, farm clothes, gloves and boots; supervised plot access.'},
      {course: 'Horticulture', requirements: 'Notebook, gloves, boots and sun hat; safe use of garden tools.'},
      {course: 'Irrigation', requirements: 'Notebook, measuring tape, calculator, boots and gloves.'},
      {course: 'Poultry', requirements: 'Dedicated washable overalls and boots; comply with biosecurity rules.'},
      {course: 'Livestock', requirements: 'Overalls, sturdy boots and gloves; supervised animal handling.'},
      {course: 'Fish Farming', requirements: 'Non-slip boots and gloves; comply with water and pond safety rules.'},
      {course: 'Pasture and Feed Production', requirements: 'Notebook, calculator and gloves; dust protection as directed.'},
      {course: 'Football Coaching', requirements: 'Sports kit, trainers or boots, notebook, whistle and water bottle.'},
      {course: 'Athletics Coaching', requirements: 'Sports kit, trainers, notebook and water bottle.'},
      {course: 'Sports/Athletics Personnel', requirements: 'Notebook, sports attire and closed shoes; event safety briefing.'}
    ]),
    sharedToolsNote: z.string().trim().max(600).default(
      'KASA provides or arranges shared specialist tools, farm inputs, agrochemicals, animal medicines and specialist sports equipment. Task-specific PPE beyond ordinary personal workwear is provided or confirmed by KASA.'
    )
  }).default({}),
  packSource: z.enum(['generated', 'custom']).default('generated'),
  customPdf: z.object({
    type: z.enum(['upload', 'link']).default('upload'),
    url: z.string().trim().default(''),
    fileName: z.string().trim().default(''),
    uploadedAt: z.string().nullable().default(null),
    fileSize: z.number().nullable().default(null)
  }).default({type: 'upload', url: '', fileName: '', uploadedAt: null, fileSize: null}),
  enrollmentForm: z.object({
    downloadType: z.enum(['upload', 'link']).default('link'),
    url: z.string().trim().default(''),
    fileName: z.string().trim().default('Official_KASA_Enrollment_Form.pdf'),
    uploadedAt: z.string().nullable().default(null),
    fileSize: z.number().nullable().default(null)
  }).default({downloadType: 'link', url: '', fileName: 'Official_KASA_Enrollment_Form.pdf', uploadedAt: null, fileSize: null}),
  enrollmentFormOffsets: enrollmentFormOffsetsSchema.default({})
});


export type AcceptanceLetterConfig = z.infer<typeof acceptanceLetterConfigSchema>;

export const defaultAcceptanceLetterConfig: AcceptanceLetterConfig = acceptanceLetterConfigSchema.parse({});
