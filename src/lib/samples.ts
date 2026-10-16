/** Example emails for the UI. Illustrative only, not part of the evaluation. */
export const SAMPLE_EMAILS: { label: string; tag: 'danger' | 'suspicious' | 'safe'; sender: string; content: string }[] = [
  {
    label: 'Fake Investment Pitch',
    tag: 'danger',
    sender: 'John Doe <partner@sequoia-cap-seed.com>',
    content: 'Subject: Urgent: Direct Investment & Term Sheet for your startup\n\nHey,\n\nLoved your launch on Product Hunt. We want to fast-track a $250k seed check into your round. Review our standard term sheet on this secure portal: https://bit.ly/3xYp9kQ\n\nLet me know by EOD if you can sign so we can wire the funds.\n\nBest,\nJohn Doe\nPartner, Sequoia Capital Seed',
  },
  {
    label: 'Package Delivery Scam',
    tag: 'danger',
    sender: 'UPS Delivery <notifications@ups-track.info>',
    content: 'Subject: Your package could not be delivered - action required\n\nDear Customer,\n\nWe attempted to deliver your package but no one was available. Please confirm your delivery details and pay a small redelivery fee of $1.99 to reschedule.\n\nUpdate your information: http://192.168.44.21/ups-redelivery\n\nFailure to respond within 48 hours will result in the package being returned to sender.\n\nUPS Customer Service',
  },
  {
    label: 'Account Compromise Scare',
    tag: 'danger',
    sender: 'Google Security <no-reply@accounts-google.com>',
    content: 'Subject: Your account has been compromised - verify immediately\n\nDear User,\n\nWe have detected suspicious activity on your Google account. Your account will be suspended within 24 hours unless you verify your identity.\n\nLog in and reset your password here: http://203.0.113.45/verify\n\nGoogle Security Team',
  },
  {
    label: 'Real Security Notice',
    tag: 'safe',
    sender: 'GitHub <noreply@github.com>',
    content: 'Subject: [GitHub] A new SSH authentication public key was added to your account\n\nHey there,\n\nThe following SSH key was added to your account: laptop-2026\n\nIf you believe this key was added in error, you can remove the key and disable access at https://github.com/settings/keys\n\nThanks,\nThe GitHub Team',
  },
  {
    label: 'Legitimate Email',
    tag: 'safe',
    sender: 'Sarah Chen <sarah.chen@gmail.com>',
    content: "Subject: Great meeting you at the conference!\n\nHi,\n\nIt was great meeting you at the conference yesterday. I'd love to grab coffee next week and talk about what you're building. Let me know what works for you.\n\nBest,\nSarah",
  },
];
