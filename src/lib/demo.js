/** Demo seed data — realistic sample calls/leads for sales demos. */
const HOUR = 3600e3;
const DAY = 24 * HOUR;

function ago(ms) {
  return new Date(Date.now() - ms).toISOString();
}

export function demoCalls() {
  return [
    {
      id: 'demo-call-1', callSid: 'CAdemo0001', from: '+44 7911 123456',
      startedAt: ago(2 * HOUR), endedAt: ago(2 * HOUR - 214e3), durationSec: 214,
      status: 'completed', afterHours: false, urgency: 'STANDARD', leadId: 'demo-lead-1', demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Good morning, thank you for calling TabSphere — this is AVA, the digital receptionist. How can I help you today?", ts: ago(2 * HOUR) },
        { role: 'CALLER', content: "Hi, I'm interested in getting an e-commerce website built for my bakery.", ts: ago(2 * HOUR - 12e3) },
        { role: 'AVA', content: "Lovely! An online shop for your bakery sounds great. May I take your name and the name of the business?", ts: ago(2 * HOUR - 30e3) },
        { role: 'CALLER', content: "It's Sarah Mitchell, and the bakery is called The Stirling Crumb.", ts: ago(2 * HOUR - 48e3) },
        { role: 'AVA', content: "Thanks Sarah! Roughly what budget did you have in mind for the project?", ts: ago(2 * HOUR - 66e3) },
        { role: 'CALLER', content: "We're thinking around two to three thousand pounds.", ts: ago(2 * HOUR - 82e3) },
        { role: 'AVA', content: "Perfect, that's a realistic range for a full e-commerce build. What's the best number and email to reach you on, and when would suit for a callback?", ts: ago(2 * HOUR - 100e3) },
        { role: 'CALLER', content: "sarah@thestirlingcrumb.co.uk — afternoons are best.", ts: ago(2 * HOUR - 125e3) },
        { role: 'AVA', content: "All noted, Sarah. I've passed your enquiry to the team and someone will call you this afternoon. Is there anything else I can help with?", ts: ago(2 * HOUR - 150e3) },
        { role: 'CALLER', content: "No that's everything, thank you!", ts: ago(2 * HOUR - 168e3) },
        { role: 'AVA', content: "You're very welcome. Have a lovely day, goodbye!", ts: ago(2 * HOUR - 185e3) },
      ],
    },
    {
      id: 'demo-call-2', callSid: 'CAdemo0002', from: '+44 7700 900442',
      startedAt: ago(5 * HOUR), endedAt: ago(5 * HOUR - 96e3), durationSec: 96,
      status: 'completed', afterHours: false, urgency: 'URGENT', leadId: 'demo-lead-2', demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Thank you for calling TabSphere, this is AVA. How can I help?", ts: ago(5 * HOUR) },
        { role: 'CALLER', content: "Our website is down — customers can't check out and we're losing orders. We need this fixed now!", ts: ago(5 * HOUR - 15e3) },
        { role: 'AVA', content: "I'm sorry to hear that — I understand this is urgent. Can I take your name and company so I can escalate this immediately?", ts: ago(5 * HOUR - 32e3) },
        { role: 'CALLER', content: "Daniel Okafor, Okafor Logistics in Falkirk.", ts: ago(5 * HOUR - 47e3) },
        { role: 'AVA', content: "Thank you Daniel. I've marked this URGENT and alerted the on-call engineer right away. What's the best number for an immediate callback?", ts: ago(5 * HOUR - 63e3) },
        { role: 'CALLER', content: "This number is fine — 07700 900442.", ts: ago(5 * HOUR - 78e3) },
        { role: 'AVA', content: "Understood — expect a call within the next 15 minutes. Anything else while I have you?", ts: ago(5 * HOUR - 88e3) },
      ],
    },
    {
      id: 'demo-call-3', callSid: 'CAdemo0003', from: '+44 7455 221890',
      startedAt: ago(26 * HOUR), endedAt: ago(26 * HOUR - 152e3), durationSec: 152,
      status: 'completed', afterHours: false, urgency: 'STANDARD', leadId: 'demo-lead-3', demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Good afternoon, TabSphere — AVA speaking. How may I help?", ts: ago(26 * HOUR) },
        { role: 'CALLER', content: "Could you tell me how much a small business website typically costs?", ts: ago(26 * HOUR - 18e3) },
        { role: 'AVA', content: "Of course! Our brochure sites start from around £600, and most small business builds land between £800 and £2,500 depending on pages and features. Would you like a tailored quote?", ts: ago(26 * HOUR - 40e3) },
        { role: 'CALLER', content: "Yes please — it's for a dog grooming salon.", ts: ago(26 * HOUR - 55e3) },
        { role: 'AVA', content: "Wonderful! May I take your name, salon name and email so the team can send a quote over?", ts: ago(26 * HOUR - 72e3) },
        { role: 'CALLER', content: "Emma Fraser, Paws & Polish Grooming, emma@pawsandpolish.scot.", ts: ago(26 * HOUR - 95e3) },
        { role: 'AVA', content: "That's all captured, Emma — a tailored quote will be with you within one working day. Anything else?", ts: ago(26 * HOUR - 115e3) },
        { role: 'CALLER', content: "No, thanks very much.", ts: ago(26 * HOUR - 130e3) },
      ],
    },
    {
      id: 'demo-call-4', callSid: 'CAdemo0004', from: '+44 7887 654321',
      startedAt: ago(50 * HOUR), endedAt: ago(50 * HOUR - 64e3), durationSec: 64,
      status: 'completed', afterHours: true, urgency: null, leadId: null, demo: true,
      voicemail: "Hi, it's Craig from Highland Outdoor Supplies — calling outside hours about getting booking software added to our site. Please call back Monday morning. Cheers.",
      transcript: [
        { role: 'AVA', content: "Thank you for calling TabSphere. Our office is currently closed — opening hours are Monday to Friday, 9am to 5:30pm. You can leave a voicemail after the tone and we'll call you back.", ts: ago(50 * HOUR) },
        { role: 'CALLER', content: "[left a voicemail]", ts: ago(50 * HOUR - 40e3) },
      ],
    },
    {
      id: 'demo-call-5', callSid: 'CAdemo0005', from: '+44 7912 345098',
      startedAt: ago(3 * DAY), endedAt: ago(3 * DAY - 188e3), durationSec: 188,
      status: 'completed', afterHours: false, urgency: 'STANDARD', leadId: 'demo-lead-4', demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Good morning, TabSphere — this is AVA. How can I help?", ts: ago(3 * DAY) },
        { role: 'CALLER', content: "Hello, I run a marketing agency and wondered if you take on white-label web development partnerships?", ts: ago(3 * DAY - 20e3) },
        { role: 'AVA', content: "We do — partnership and white-label work is something the team handles directly. May I take your details so a director can call you to discuss?", ts: ago(3 * DAY - 42e3) },
        { role: 'CALLER', content: "Sure — Priya Sharma, Brightline Marketing in Glasgow, priya@brightlinemarketing.co.uk.", ts: ago(3 * DAY - 70e3) },
        { role: 'AVA', content: "Thank you Priya. And roughly how many projects a month are you looking to outsource?", ts: ago(3 * DAY - 90e3) },
        { role: 'CALLER', content: "Probably two or three to start with.", ts: ago(3 * DAY - 108e3) },
        { role: 'AVA', content: "Great — I've logged this as a partnership enquiry and a director will be in touch shortly. Anything else?", ts: ago(3 * DAY - 130e3) },
        { role: 'CALLER', content: "That's all, thanks.", ts: ago(3 * DAY - 150e3) },
      ],
    },
    {
      id: 'demo-call-6', callSid: 'CAdemo0006', from: '+44 7555 887733',
      startedAt: ago(4 * DAY), endedAt: ago(4 * DAY - 245e3), durationSec: 245,
      status: 'completed', afterHours: false, urgency: 'STANDARD', leadId: 'demo-lead-5', demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Good afternoon, TabSphere — AVA speaking. How may I help you?", ts: ago(4 * DAY) },
        { role: 'CALLER', content: "I need a full website redesign for my accountancy firm — and potentially ongoing SEO.", ts: ago(4 * DAY - 22e3) },
        { role: 'AVA', content: "Excellent — redesign plus ongoing SEO is a great combination. Could I take your name and firm name?", ts: ago(4 * DAY - 45e3) },
        { role: 'CALLER', content: "James Caldwell, Caldwell & Rae Accountants in Dunblane.", ts: ago(4 * DAY - 68e3) },
        { role: 'AVA', content: "And do you have a budget in mind, James?", ts: ago(4 * DAY - 84e3) },
        { role: 'CALLER', content: "Around fifteen hundred pounds for the redesign.", ts: ago(4 * DAY - 100e3) },
        { role: 'AVA', content: "That's a solid budget for a professional redesign. Best email and phone number for a proposal?", ts: ago(4 * DAY - 120e3) },
        { role: 'CALLER', content: "james@caldwellrae.co.uk — and this number.", ts: ago(4 * DAY - 145e3) },
        { role: 'AVA', content: "All captured. I've flagged this as a high-value enquiry so the team will prioritise your proposal. Anything else I can help with?", ts: ago(4 * DAY - 170e3) },
        { role: 'CALLER', content: "No, that's great. Bye now.", ts: ago(4 * DAY - 195e3) },
      ],
    },
    {
      id: 'demo-call-7', callSid: 'CAdemo0007', from: '+44 7802 114455',
      startedAt: ago(6 * DAY), endedAt: ago(6 * DAY - 41e3), durationSec: 41,
      status: 'completed', afterHours: false, urgency: 'LOW', leadId: null, demo: true,
      voicemail: '',
      transcript: [
        { role: 'AVA', content: "Good morning, TabSphere — this is AVA. How can I help?", ts: ago(6 * DAY) },
        { role: 'CALLER', content: "Sorry, I think I've dialled the wrong number!", ts: ago(6 * DAY - 12e3) },
        { role: 'AVA', content: "No problem at all — have a great day!", ts: ago(6 * DAY - 28e3) },
      ],
    },
  ];
}

export function demoLeads() {
  return [
    {
      id: 'demo-lead-1', createdAt: ago(2 * HOUR - 200e3), callerNumber: '+44 7911 123456',
      callSid: 'CAdemo0001', fullName: 'Sarah Mitchell', businessName: 'The Stirling Crumb',
      email: 'sarah@thestirlingcrumb.co.uk', phone: '+44 7911 123456',
      serviceInterestedIn: 'E-commerce website (bakery)', budget: '£2,000–£3,000',
      callbackTime: 'Weekday afternoons', howTheyHeard: 'Google search', urgencyLevel: 'STANDARD',
      summary: 'Bakery owner wants an online shop with click-and-collect ordering before the Christmas rush.', demo: true,
    },
    {
      id: 'demo-lead-2', createdAt: ago(5 * HOUR - 90e3), callerNumber: '+44 7700 900442',
      callSid: 'CAdemo0002', fullName: 'Daniel Okafor', businessName: 'Okafor Logistics',
      email: null, phone: '+44 7700 900442', serviceInterestedIn: 'Website support — site down',
      budget: null, callbackTime: 'Immediately', howTheyHeard: 'Existing client', urgencyLevel: 'URGENT',
      summary: 'URGENT: checkout broken on client site, losing orders. On-call engineer alerted for callback within 15 minutes.', demo: true,
    },
    {
      id: 'demo-lead-3', createdAt: ago(26 * HOUR - 145e3), callerNumber: '+44 7455 221890',
      callSid: 'CAdemo0003', fullName: 'Emma Fraser', businessName: 'Paws & Polish Grooming',
      email: 'emma@pawsandpolish.scot', phone: '+44 7455 221890',
      serviceInterestedIn: 'Small business website', budget: '£800–£1,200',
      callbackTime: 'Any time', howTheyHeard: 'Instagram', urgencyLevel: 'STANDARD',
      summary: 'Dog grooming salon pricing enquiry — requested a tailored quote for a brochure site with booking form.', demo: true,
    },
    {
      id: 'demo-lead-4', createdAt: ago(3 * DAY - 180e3), callerNumber: '+44 7912 345098',
      callSid: 'CAdemo0005', fullName: 'Priya Sharma', businessName: 'Brightline Marketing',
      email: 'priya@brightlinemarketing.co.uk', phone: '+44 7912 345098',
      serviceInterestedIn: 'White-label partnership', budget: '2–3 projects / month',
      callbackTime: 'This week', howTheyHeard: 'Referral', urgencyLevel: 'STANDARD',
      summary: 'Glasgow marketing agency exploring white-label web development partnership — director callback requested.', demo: true,
    },
    {
      id: 'demo-lead-5', createdAt: ago(4 * DAY - 235e3), callerNumber: '+44 7555 887733',
      callSid: 'CAdemo0006', fullName: 'James Caldwell', businessName: 'Caldwell & Rae Accountants',
      email: 'james@caldwellrae.co.uk', phone: '+44 7555 887733',
      serviceInterestedIn: 'Website redesign + ongoing SEO', budget: '£1,500',
      callbackTime: 'Tomorrow morning', howTheyHeard: 'Word of mouth', urgencyLevel: 'HIGH VALUE',
      summary: 'HIGH VALUE: accountancy firm wants a full redesign (£1,500) plus a rolling SEO retainer — prioritise proposal.', demo: true,
    },
  ];
}

export function demoActivity() {
  return [
    { id: 'demo-act-1', ts: ago(2 * HOUR - 200e3), type: 'lead', message: 'New lead: Sarah Mitchell (STANDARD)', demo: true },
    { id: 'demo-act-2', ts: ago(2 * HOUR), type: 'call', message: 'Call ended (completed) from +44 7911 123456 — 214s', demo: true },
    { id: 'demo-act-3', ts: ago(5 * HOUR - 90e3), type: 'lead', message: 'New lead: Daniel Okafor (URGENT)', demo: true },
    { id: 'demo-act-4', ts: ago(5 * HOUR), type: 'call', message: 'Call ended (completed) from +44 7700 900442 — 96s', demo: true },
    { id: 'demo-act-5', ts: ago(26 * HOUR), type: 'call', message: 'Call ended (completed) from +44 7455 221890 — 152s', demo: true },
    { id: 'demo-act-6', ts: ago(50 * HOUR), type: 'voicemail', message: 'Voicemail left by +44 7887 654321 (after-hours)', demo: true },
    { id: 'demo-act-7', ts: ago(3 * DAY), type: 'lead', message: 'New lead: Priya Sharma (STANDARD)', demo: true },
    { id: 'demo-act-8', ts: ago(4 * DAY), type: 'lead', message: 'New lead: James Caldwell (HIGH VALUE)', demo: true },
  ];
}
