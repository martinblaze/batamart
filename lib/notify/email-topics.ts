// lib/notify/email-topics.ts
// The library behind the automatic email writer (see email-drafts.ts).
//
// Each topic has keywords used to recognise it, up to three paragraphs that are
// added after the admin's own words, and a button label. Paragraphs may only
// state things that are true of BataMart today:
//   - deliveries run every Wednesday and Saturday, flat NGN 1,200 per order
//   - money is held in escrow; the seller is paid 48 hours after the buyer
//     confirms delivery; disputes open within 48 hours with an evidence image
//   - referral reward NGN 120 per delivered order, no cap
//   - listing is free; seller commission 5%; minimum withdrawal NGN 2,000
//   - wallet top-ups NGN 100 to NGN 500,000; wallet PIN is 6 digits
//   - usernames: 3 to 20 letters and numbers, one owner each
// Never add discounts, dates, prices, giveaways or promises here: the admin's
// message carries anything specific. If a fact changes, change it here and on
// the Terms page.
//
// Keywords are plain lowercase phrases; a title hit counts more than a message
// hit, so the most specific topic wins.

export interface EmailTopic {
  key: string
  label: string
  group: string
  keywords: string[]
  more: string[]
  button: string
}

const t = (
  group: string,
  key: string,
  label: string,
  keywords: string[],
  more: string[],
  button: string,
): EmailTopic => ({ group, key, label, keywords, more, button })

export const EMAIL_TOPICS: EmailTopic[] = [
  // ── Account and getting started ─────────────────────────────────────────
  t('Account', 'username', 'Username', ['username', 'user name', 'setup=username'], [
    'Sellers write your username on your parcel instead of your name and address, so your details stay private.',
    'Each username can belong to only one person, so the sooner you pick yours the better. You will also need one to place your next order.',
    'It takes about ten seconds: choose 3 to 20 letters and numbers, and you are done.',
  ], 'Set my username'),
  t('Account', 'welcome', 'Welcome new users', ['welcome', 'new here', 'just joined', 'getting started', 'get started', 'new to batamart'], [
    'BataMart is the campus marketplace for Awka. You can buy from students you can trust, and your money is held safely until your order arrives.',
    'Deliveries run every Wednesday and Saturday for a flat ₦1,200 per order, straight to your hostel. Listing your own items costs nothing.',
    'Start by browsing what students around you are selling.',
  ], 'Start browsing'),
  t('Account', 'complete-profile', 'Complete your profile', ['complete your profile', 'delivery address', 'room number', 'update your address', 'your profile'], [
    'Your delivery address tells the rider exactly where to bring your order, so it needs your hostel or lodge, your room number and your area.',
    'Your address is only shown to the rider who delivers your order, never to sellers.',
    'It takes a minute to check it is right before your next order.',
  ], 'Update my profile'),
  t('Account', 'security-tips', 'Account security tips', ['security', 'secure your account', 'stay safe', 'keep your account', 'protect your account'], [
    'Never share your password, your wallet PIN or any code we send you with anyone, including people who say they work for BataMart.',
    'Your wallet PIN is a 6-digit code that protects withdrawals and wallet payments. Choose one you do not use anywhere else.',
    'If anything looks wrong with your account, contact support straight away.',
  ], 'Review my security'),
  t('Account', 'wallet-pin', 'Set a wallet PIN', ['wallet pin', 'set a pin', 'your pin', 'withdrawal pin', 'create a pin'], [
    'A wallet PIN is a 6-digit code that protects your money. It is needed to withdraw and to pay from your wallet.',
    'Without one, your balance has less protection than it should, so it is worth setting up now.',
    'It takes under a minute from your wallet page.',
  ], 'Set my PIN'),
  t('Account', 'password', 'Password reminder', ['password', 'reset your password', 'change your password'], [
    'A strong, unique password is the first line of defence for your account and your wallet.',
    'If you have not changed yours in a while, or you use it on other sites, now is a good time to update it.',
    'You can reset it from the login page at any time.',
  ], 'Open BataMart'),
  t('Account', 'notifications', 'Notification settings', ['notification settings', 'notifications', 'turn on notifications', 'alerts', 'stay updated'], [
    'Notifications tell you when a rider is on the way, when your order arrives and when money lands in your wallet.',
    'You choose what you receive. Order, payment and security messages always reach you, and you can switch off reminders, deals and offers any time.',
    'Check your settings so you only hear about what matters to you.',
  ], 'Choose my notifications'),
  t('Account', 'install-app', 'Install the app', ['install', 'download the app', 'android app', 'get the app', 'home screen'], [
    'The BataMart app gives you live rider tracking, quick checkout and notifications on your phone.',
    'On Android you can download it directly. On iPhone, open BataMart in Safari and choose Add to Home Screen.',
    'It takes about a minute, and your account works exactly the same.',
  ], 'Get the app'),
  t('Account', 'app-update', 'App update', ['app update', 'new version', 'update the app', 'latest version', 'update your app'], [
    'A new version of the BataMart app is available, with improvements to speed and reliability.',
    'Updating makes sure you get the latest features and fixes.',
    'It only takes a moment, and your account and orders are exactly as you left them.',
  ], 'Update the app'),

  // ── Shopping ───────────────────────────────────────────────────────────
  t('Shopping', 'referral', 'Referral programme', ['referral', 'refer a friend', 'invite friends', 'invite a friend', 'earn', 'earn from friends', 'referral code', 'your code', 'share your code'], [
    'Every BataMart account already has a referral code. When a friend joins with it and their order is delivered, ₦120 goes straight into your wallet.',
    'There is no limit. Every delivered order from every friend you bring pays you, and you can see each reward on your Referrals page.',
    'Share your code in your hostel group, your course chat or with friends, and watch the earnings add up.',
  ], 'Get my referral code'),
  t('Shopping', 'deals', 'Deals and discounts', ['deal', 'discount', '% off', 'percent off', 'sale', 'cheap', 'bargain', 'price drop'], [
    'Prices move quickly on campus, and the best deals are often gone within days.',
    'Every deal on BataMart shows the exact percentage off, and your payment stays protected until you confirm delivery.',
    'Open the deals page to see what is cheapest right now.',
  ], 'See the deals'),
  t('Shopping', 'hot-deals', 'Hot items', ['hot deals', 'trending', 'hot right now', 'popular', 'most bought', 'everyone is buying'], [
    'Some items are hot because lots of students are looking at them, and some because their price has dropped.',
    'The hot items page shows both, with the exact percentage off wherever there is a discount.',
    'See what the campus is buying right now.',
  ], 'See what is hot'),
  t('Shopping', 'new-arrivals', 'New listings', ['new arrivals', 'new listings', 'just dropped', 'just listed', 'new items', 'new products'], [
    'New items are listed by students around you every day.',
    'The earliest buyers usually get the best choice, especially on single items and limited stock.',
    'Take a look at what has just arrived.',
  ], 'See new arrivals'),
  t('Shopping', 'recommended', 'Recommended for you', ['recommended', 'picked for you', 'based on what you', 'you might like'], [
    'We pick items for you based on what you have viewed and searched for on BataMart.',
    'The more you browse, the better the picks fit you.',
    'See your recommendations in one place.',
  ], 'See my picks'),
  t('Shopping', 'electronics', 'Electronics', ['electronics', 'phone', 'phones', 'earbuds', 'power bank', 'powerbank', 'charger', 'speaker', 'gadget'], [
    'Phones, chargers, earbuds, power banks and more are listed by students on your campus.',
    'Check the photos and description, and remember your payment is held safely until you confirm your order arrived as described.',
    'Browse electronics and compare prices.',
  ], 'Shop electronics'),
  t('Shopping', 'computing', 'Laptops and computing', ['laptop', 'computing', 'computer', 'keyboard', 'mouse', 'monitor', 'flash drive', 'hard drive'], [
    'Laptops and computer accessories are some of the most searched items on campus.',
    'Read each description carefully and ask the questions that matter before you order: condition, specs and what is included.',
    'See what is available near you.',
  ], 'Shop computing'),
  t('Shopping', 'fashion', 'Fashion', ['fashion', 'clothes', 'clothing', 'sneakers', 'shoes', 'bags', 'watches', 'outfit', 'thrift', 'wear'], [
    'Clothes, shoes, bags and accessories from students who know what is in style on campus.',
    'Photos show exactly what you are getting, and your payment is protected until your order arrives.',
    'Browse the latest fashion listings.',
  ], 'Shop fashion'),
  t('Shopping', 'food', 'Food and groceries', ['food', 'groceries', 'snacks', 'drinks', 'cook', 'meal', 'provisions', 'jollof'], [
    'Food, snacks, drinks and groceries from sellers on your campus.',
    'Because deliveries run on Wednesdays and Saturdays, order ahead for what you will need, and check the ready time on each listing.',
    'See what is on offer.',
  ], 'Shop food'),
  t('Shopping', 'books', 'Books and stationery', ['books', 'textbook', 'textbooks', 'stationery', 'notebook', 'past questions', 'handout', 'pens'], [
    'Textbooks, notebooks, past questions and stationery from students who have just finished with them.',
    'Buying from someone on your own campus often means the right edition for your course.',
    'Find what you need for your classes.',
  ], 'Shop books'),
  t('Shopping', 'beauty', 'Beauty and health', ['beauty', 'skincare', 'makeup', 'hair', 'wig', 'wigs', 'perfume', 'cosmetics', 'wellness'], [
    'Skincare, hair, makeup and wellness products from sellers around campus.',
    'Read the description and photos closely, and remember you have 48 hours after delivery to raise a problem.',
    'Browse beauty and health.',
  ], 'Shop beauty'),
  t('Shopping', 'home', 'Home and kitchen', ['home and kitchen', 'kitchen', 'appliance', 'bedding', 'furniture', 'mattress', 'cooker', 'blender'], [
    'Everything for your room: appliances, bedding, kitchenware and small furniture.',
    'Large items may be too big for a motorcycle, so check the size on the listing before you order.',
    'Browse home and kitchen.',
  ], 'Shop home'),
  t('Shopping', 'sports', 'Sports and fitness', ['sports', 'fitness', 'gym', 'jersey', 'football', 'workout', 'supplements', 'sportswear'], [
    'Gym gear, jerseys, sportswear and fitness items from students on campus.',
    'Every order is protected until it arrives, so you can buy with confidence.',
    'See the latest sports and fitness listings.',
  ], 'Shop sports'),
  t('Shopping', 'gaming', 'Gaming', ['gaming', 'playstation', 'ps5', 'ps4', 'xbox', 'console', 'game pad', 'gamepad', 'controller'], [
    'Consoles, controllers, games and accessories from gamers on your campus.',
    'Ask about condition and what is included before you order, and keep your payment protected through BataMart.',
    'Browse gaming listings.',
  ], 'Shop gaming'),
  t('Shopping', 'tickets', 'Tickets and events', ['ticket', 'tickets', 'event', 'events', 'party', 'concert'], [
    'Event tickets and passes from students on your campus.',
    'Only buy through BataMart so your payment is protected, and check the details of the event on the listing.',
    'See what is coming up.',
  ], 'See events'),
  t('Shopping', 'arts', 'Arts and crafts', ['arts', 'crafts', 'handmade', 'painting'], [
    'Handmade items, art and craft supplies from creative students on campus.',
    'Supporting a student seller keeps your money on campus, and your order is still protected.',
    'Discover what students are making.',
  ], 'Browse crafts'),
  t('Shopping', 'kids', 'Kids and baby', ['kids', 'baby', 'children', 'toys', 'infant'], [
    'Items for babies and children from sellers around you.',
    'Check the photos and description carefully, and remember you can raise a problem within 48 hours of delivery.',
    'Browse kids and baby.',
  ], 'Browse kids'),
  t('Shopping', 'vehicles', 'Vehicles and transport', ['vehicle', 'bike', 'bicycle', 'motorcycle', 'transport', 'tricycle', 'car '], [
    'Bikes, accessories and transport items listed by students and sellers on campus.',
    'Large items are not suitable for rider delivery, so check how the item will reach you before you order.',
    'See what is listed.',
  ], 'Browse vehicles'),
  t('Shopping', 'study-essentials', 'Study essentials', ['study', 'exam', 'exams', 'semester', 'calculator', 'lab coat', 'drawing tools', 'extension box', 'revision', 'test'], [
    'Calculators, drawing tools, lab coats, flash drives, extension boxes, textbooks and stationery are all listed by students on campus.',
    'Order early, because deliveries run on Wednesdays and Saturdays and some items take a few days to be ready.',
    'Get what you need before you need it.',
  ], 'Shop study essentials'),
  t('Shopping', 'new-semester', 'New semester', ['new semester', 'resumption', 'back to school', 'back to campus', 'new session', 'freshers', 'fresher', 'matriculation', 'move in', 'move-in'], [
    'A new semester means a long list of things to get, from textbooks and stationery to bedding, kitchenware and phone accessories.',
    'Everything you need is listed by students near you, delivered to your hostel on Wednesdays and Saturdays for a flat ₦1,200 per order.',
    'Order early to be set before classes get busy.',
  ], 'Start shopping'),
  t('Shopping', 'festive', 'Festive season', ['christmas', 'festive', 'holiday', 'holidays', 'new year', 'easter', 'sallah', 'eid', 'celebrate'], [
    'The festive season is busy for everyone, so it pays to order early.',
    'Browse gifts, outfits and everything you need for the celebrations, all from students on campus.',
    'Deliveries run every Wednesday and Saturday, so plan your orders around them.',
  ], 'Browse gifts'),
  t('Shopping', 'girlfriends-day', 'Valentine and gifts', ['girlfriend', "girlfriend's day", 'valentine', 'gift', 'gifts', 'romantic', 'surprise'], [
    'Looking for something thoughtful? Students on campus are listing gifts of every kind.',
    'Order early so it arrives on time. Deliveries run on Wednesdays and Saturdays.',
    'Browse gift ideas.',
  ], 'Find a gift'),
  t('Shopping', 'weekend', 'Weekend', ['weekend', 'friday', 'this weekend'], [
    'Planning ahead for the weekend? Orders placed from Wednesday to Friday arrive on Saturday.',
    'Browse, order and get it delivered to your hostel for a flat ₦1,200.',
    'Order before the cut-off to make Saturday.',
  ], 'Order now'),
  t('Shopping', 'month-end', 'End of month', ['month end', 'month-end', 'allowance', 'salary', 'pay day', 'payday', 'end of the month'], [
    'Stretching your allowance? Compare prices across listings and look out for the deals page.',
    'Every deal shows the exact percentage off, so you can see the saving before you order.',
    'See what is worth buying this month.',
  ], 'See deals'),

  // ── Orders and delivery ────────────────────────────────────────────────
  t('Orders', 'delivery', 'Delivery schedule', ['delivery', 'deliver', 'wednesday', 'saturday', 'rider', 'arrive', 'flat fee', 'delivery fee'], [
    'BataMart delivers every Wednesday and Saturday for a flat ₦1,200 per order, to anywhere on campus.',
    'Orders placed from Saturday to Tuesday arrive on Wednesday, and orders placed from Wednesday to Friday arrive on Saturday. You can follow your rider live for the last stretch, and confirm when it reaches you.',
    'Place your order now to be on the next run.',
  ], 'Start shopping'),
  t('Orders', 'delivery-reminder', 'Delivery day reminder', ['arrives today', 'arrives tomorrow', 'delivery day', 'today is delivery', 'tomorrow is delivery', 'on the way today'], [
    'Your order is on the delivery run, so keep your phone close and stay reachable.',
    'You can follow your rider live on the order page once they are on their way to you.',
    'When your order arrives, tap Mark delivered so the rider is paid.',
  ], 'Track my order'),
  t('Orders', 'track-order', 'Track your order', ['track', 'tracking', 'live map', 'where is my order', 'follow your rider'], [
    'Once your order is on its way from our sorting hub, you can follow your rider live on a map from your order page.',
    'You will also get a notification at each step: collected, at our hub, packed and out for delivery.',
    'Open your order any time to see where it is.',
  ], 'Track my order'),
  t('Orders', 'confirm-delivery', 'Confirm delivery', ['mark delivered', 'confirm delivery', 'received your order', 'did your order arrive', 'confirm you received'], [
    'When your order reaches you, tap Mark delivered on the order page. A rider cannot confirm delivery for you.',
    'Confirming pays the rider and starts the seller payout clock, and you still have 48 hours to raise a problem.',
    'It only takes a tap.',
  ], 'Confirm my order'),
  t('Orders', 'review-reminder', 'Leave a review', ['review', 'rate', 'rating', 'feedback on your order', 'how was your order', 'leave a review'], [
    'Reviews help other students buy with confidence, and they help good sellers get noticed.',
    'It takes about ten seconds, and you can review both the product and the seller.',
    'Tell the campus how your order went.',
  ], 'Leave a review'),
  t('Orders', 'disputes', 'How disputes work', ['dispute', 'something wrong', 'problem with my order', 'wrong item', 'damaged', 'not as described'], [
    'If an order arrives and something is wrong, you can open a dispute within 48 hours of delivery and attach at least one photo as evidence.',
    'Our support team reviews both sides before anything is settled, and the seller is not paid while a dispute is open.',
    'Open the dispute from the order page.',
  ], 'Open my orders'),
  t('Orders', 'cancelled-refund', 'Order cancelled and refunded', ['cancelled', 'cancellation', 'refund', 'refunded', 'not available', 'out of stock', 'unavailable'], [
    'When an order cannot go ahead, for example because the product is not available, the full amount is refunded to your BataMart wallet.',
    'You can spend that money on any order or withdraw it, and nothing more is needed from you.',
    'Your wallet shows the refund straight away.',
  ], 'Open my wallet'),
  t('Orders', 'delivery-delay', 'Delivery moved', ['delay', 'delayed', 'moved to', 'rescheduled', 'postponed', 'not ready', 'next delivery day'], [
    'Sometimes an item is not ready when the rider arrives. When that happens, the order moves to the next delivery day, either Wednesday or Saturday.',
    'You are told as soon as it moves, and your payment stays protected the whole time.',
    'Check your order page for the new delivery day.',
  ], 'See my order'),
  t('Orders', 'order-more', 'Order again', ['order again', 'reorder', 're-order', 'buy again', 'restock'], [
    'If you liked something, buying again is quick. Your delivery address and username are already saved.',
    'Orders placed before the cut-off make the next delivery run.',
    'Find what you ordered before.',
  ], 'Order again'),

  // ── Wallet and payments ────────────────────────────────────────────────
  t('Wallet', 'wallet', 'Wallet', ['wallet', 'pay with wallet', 'wallet balance'], [
    'Your BataMart wallet lets you top up once and pay for orders in a tap, with no card details to type each time.',
    'Refunds for cancelled orders land there too, so your money is always ready to spend or withdraw.',
    'You can top up from ₦100 whenever you like.',
  ], 'Open my wallet'),
  t('Wallet', 'top-up', 'Top up wallet', ['top up', 'topup', 'add money', 'fund your wallet', 'fund wallet'], [
    'Add money to your wallet by card or bank transfer, from ₦100 up to ₦500,000.',
    'Once it is in, checkout is a single tap, and any refund comes straight back to the same balance.',
    'It takes under a minute.',
  ], 'Top up my wallet'),
  t('Wallet', 'withdraw', 'Withdrawals', ['withdraw', 'withdrawal', 'cash out', 'payout', 'send to bank'], [
    'You can withdraw your wallet balance to your bank account at any time. The minimum withdrawal is ₦2,000, and you confirm it with your wallet PIN.',
    'Seller earnings are released 48 hours after the buyer confirms delivery, and show up in your wallet from then.',
    'Check your balance and withdraw from your wallet page.',
  ], 'Open my wallet'),
  t('Wallet', 'payment-safe', 'Your payment is safe', ['escrow', 'payment protected', 'safe payment', 'secure payment', 'money is safe', 'buyer protection'], [
    'When you pay on BataMart, your money is held in escrow. The seller is not paid when you check out.',
    'The seller is paid 48 hours after you confirm delivery, and only if no dispute is open.',
    'That is what makes it safe to buy from someone you have never met.',
  ], 'Start shopping'),

  // ── Sellers ────────────────────────────────────────────────────────────
  t('Sellers', 'sell', 'Start selling', ['sell', 'selling', 'list an item', 'listing', 'start a shop', 'become a seller', 'open a shop'], [
    'Listing on BataMart is free, and students around you are searching every day.',
    'Add clear photos and an honest description, set how many days it takes to be ready, and we handle collection and delivery on Wednesdays and Saturdays. You are paid 48 hours after the buyer confirms delivery.',
    'It takes about a minute to post your first item.',
  ], 'List an item'),
  t('Sellers', 'seller-tips', 'Seller tips', ['seller tips', 'sell faster', 'tips for sellers', 'sell more', 'better listings', 'good photos'], [
    'Clear photos from more than one angle, an honest description and a fair price are what sell fastest on BataMart.',
    'Set a realistic ready time on each listing and keep your stock count up to date, so buyers get what they ordered when they expect it.',
    'A few minutes on your listings can make a real difference.',
  ], 'Open my shop'),
  t('Sellers', 'seller-packaging', 'Packing and labelling', ['packaging', 'packing', 'wrap', 'label', 'label your parcel', 'write the username'], [
    'Wrap every parcel securely, and write the buyer’s @username and the order code clearly on it.',
    'You only ever see the username, never the buyer’s name or address, and the sorting hub uses the label to pack each order correctly.',
    'Well-wrapped, well-labelled parcels arrive faster and get better reviews.',
  ], 'View my orders'),
  t('Sellers', 'seller-pickup', 'Mark picked up', ['mark picked up', 'handover', 'hand over', 'rider is coming', 'pickup day', 'ready for pickup', 'pick up'], [
    'On delivery days, a rider collects parcels from sellers. Have each parcel ready, wrapped and labelled.',
    'When the rider takes it, tap Mark picked up on the order. A rider cannot do this for you.',
    'If a parcel is not ready when the rider arrives, the order moves to the next delivery day and the buyer is told.',
  ], 'View my orders'),
  t('Sellers', 'seller-payout', 'Seller payouts', ['seller payout', 'get paid', 'when do i get paid', 'earnings', 'seller earnings', 'sales money'], [
    'Seller earnings are held until the buyer confirms delivery, then released 48 hours later if no dispute is open.',
    'BataMart takes a 5% commission on the product price. The delivery fee is paid by the buyer and is not taken from you.',
    'Your released earnings show in your wallet, ready to withdraw.',
  ], 'Open my wallet'),
  t('Sellers', 'restock', 'Restock reminder', ['low stock', 'running low', 'out of stock listing', 'sold out', 'restock your'], [
    'Items that run out disappear from search, so buyers cannot find them.',
    'Restocking takes a moment and puts the listing straight back in front of shoppers.',
    'Check your listings and top up your stock.',
  ], 'Restock my items'),
  t('Sellers', 'listing-review', 'Listing review', ['approved', 'approval', 'under review', 'listing review', 'rejected', 'moderation'], [
    'New listings, and edits to a listing’s name, photos, description or price, are reviewed before they appear on the marketplace.',
    'We usually review within a day, and you are notified the moment a decision is made.',
    'Open your shop to see where each listing stands.',
  ], 'Open my shop'),
  t('Sellers', 'seller-rules', 'Seller rules', ['oversized', 'too large', 'strike', 'suspension', 'seller policy', 'seller rules'], [
    'Items that are too large to carry safely by motorcycle can be declined by the rider. The buyer is refunded and the listing goes under review.',
    'Repeated problems lead to strikes: the first is a warning, then suspensions that get longer.',
    'Check the size and weight of your items when you list them.',
  ], 'Read the seller terms'),

  // ── Riders ─────────────────────────────────────────────────────────────
  t('Riders', 'rider', 'Riders', ['ride with', 'join as a rider', 'become a rider', 'rider', 'riders'], [
    'BataMart riders collect parcels from sellers, bring them to our sorting hub and deliver them to buyers on Wednesdays and Saturdays.',
    'Riders earn a share of the delivery fee on every order they handle.',
    'If you would like to ride with us, contact support and we will get back to you.',
  ], 'Contact support'),

  // ── Platform and company ───────────────────────────────────────────────
  t('Platform', 'new-feature', 'New feature', ['new feature', 'introducing', 'now you can', 'we have added', 'just launched', 'launch', 'now available', "what's new", 'whats new'], [
    'We are always working on BataMart to make buying and selling on campus simpler and safer.',
    'This update is live now for everyone, with nothing you need to install on the website.',
    'Take a look and tell us what you think.',
  ], 'See what is new'),
  t('Platform', 'maintenance', 'Scheduled maintenance', ['maintenance', 'downtime', 'unavailable for', 'briefly offline', 'upgrade', 'upgrading'], [
    'We are making improvements to BataMart, and some features may be briefly unavailable while we do.',
    'If you have an order in progress, you can follow it on your order page once we are back.',
    'Thank you for your patience while we make BataMart better.',
  ], 'Open BataMart'),
  t('Platform', 'back-online', 'Back online', ['back online', 'we are back', 'issue fixed', 'resolved', 'fixed now', 'working again'], [
    'The issue is fixed and everything is working normally again.',
    'We are sorry for the trouble, and grateful for your patience.',
    'If anything still looks wrong, contact support and we will help right away.',
  ], 'Open BataMart'),
  t('Platform', 'policy-update', 'Terms and privacy update', ['terms', 'privacy', 'policy', 'policies', 'terms of service', 'updated our'], [
    'We have updated our terms and privacy policy so they match exactly how BataMart works today.',
    'They explain how payments, delivery, disputes and referrals work, and who can see your details.',
    'It only takes a few minutes to read, and your account works exactly as before.',
  ], 'Read the terms'),
  t('Platform', 'support', 'Contact support', ['support', 'help', 'contact us', 'need help', 'customer care', 'customer service'], [
    'Our support team helps with orders, payments, disputes and anything else on BataMart.',
    'Send us a message from the contact page and you will get a reference you can quote back. We usually reply within 24 to 48 hours.',
    'We are here when something goes wrong.',
  ], 'Contact support'),
  t('Platform', 'safety', 'Stay safe from scams', ['scam', 'fraud', 'phishing', 'fake', 'stay safe from', 'be careful', 'pay outside'], [
    'Only ever pay through BataMart. Money sent outside the app, to a personal account, is not protected.',
    'We will never ask for your password, your wallet PIN or a code sent to you.',
    'If someone asks you to pay or chat outside BataMart, report it to support.',
  ], 'Report to support'),
  t('Platform', 'feedback', 'Share feedback', ['survey', 'tell us', 'we want to hear', 'give us feedback', 'suggestions', 'your opinion', 'improve batamart'], [
    'BataMart changes based on what students tell us, so your opinion genuinely matters.',
    'Tell us what works, what does not and what you would like to see next.',
    'It only takes a minute.',
  ], 'Give feedback'),
  t('Platform', 'thank-you', 'Thank you', ['thank you', 'thanks', 'milestone', 'celebrate with us', 'we reached', 'anniversary'], [
    'Thank you for being part of BataMart. Every order, listing and referral helps make buying and selling on campus better.',
    'We are building this for students, with students, and we are glad you are here.',
    'Here is to more good things ahead.',
  ], 'Open BataMart'),
  t('Platform', 'win-back', 'We miss you', ['we miss you', 'come back', 'been a while', 'miss you', 'long time', 'still here'], [
    'It has been a while, and a lot has been listed on campus since you last visited.',
    'New items arrive every day, and your account, address and wallet are just as you left them.',
    'Take a quick look at what you missed.',
  ], 'See what is new'),
  t('Platform', 'community', 'Community', ['community', 'campus life', 'student sellers', 'support student', 'support local'], [
    'BataMart is built for one campus at a time, so every order supports a student seller close to you.',
    'Buying here means a delivery to your hostel, a seller you can review and your money held safely.',
    'Thank you for keeping it local.',
  ], 'Open BataMart'),
]

export const EMAIL_TOPIC_GROUPS = Array.from(new Set(EMAIL_TOPICS.map(topic => topic.group)))
