// run-seed.mjs
// Run with: node prisma/run-seed.mjs
// This seeds CategoryAttribute rows for every subcategory in CATEGORY_TREE

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -- Inline CATEGORY_TREE (copied from lib/variants.ts) -----------------------
// We inline it here to avoid TypeScript/ESM import issues when running directly

const CATEGORY_TREE = {
  electronics: {
    label: 'Electronics', icon: '[Electronics]',
    subcategories: {
      phones_tablets: { label: 'Phones & Tablets', variants: [
        { key: 'brand',          label: 'Brand',          suggestions: ['Apple','Samsung','Tecno','Infinix','Xiaomi','OnePlus','Google','Nokia','Huawei','Oppo','Vivo','Realme','Itel'] },
        { key: 'model',          label: 'Model',          suggestions: ['iPhone 13','iPhone 14','iPhone 15','iPhone 16','Galaxy S24','Galaxy A55','Tecno Camon 30','Infinix Hot 40'] },
        { key: 'storage',        label: 'Storage',        suggestions: ['16GB','32GB','64GB','128GB','256GB','512GB','1TB'] },
        { key: 'ram',            label: 'RAM',            suggestions: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB'] },
        { key: 'color',          label: 'Color',          suggestions: ['Black','White','Gold','Blue','Red','Purple','Green','Pink','Silver'] },
        { key: 'condition',      label: 'Condition',      suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
        { key: 'network',        label: 'Network',        suggestions: ['4G LTE','5G','3G'] },
        { key: 'sim',            label: 'SIM',            suggestions: ['Single SIM','Dual SIM','eSIM'] },
        { key: 'battery_health', label: 'Battery Health', suggestions: ['100%','95%','90%','85%','80%','Below 80%'] },
        { key: 'warranty',       label: 'Warranty',       suggestions: ['No Warranty','1 Month','3 Months','6 Months','1 Year'] },
        { key: 'accessories',    label: 'Comes With',     suggestions: ['Box','Charger','Earphones','None'] },
      ]},
      laptops: { label: 'Laptops', variants: [
        { key: 'brand',       label: 'Brand',            suggestions: ['Apple','Dell','HP','Lenovo','Asus','Acer','Microsoft','LG','MSI','Toshiba','Sony'] },
        { key: 'processor',   label: 'Processor',        suggestions: ['Intel Core i3','Intel Core i5','Intel Core i7','Intel Core i9','M1','M2','M3','M3 Pro','Ryzen 5','Ryzen 7','Ryzen 9','Celeron'] },
        { key: 'ram',         label: 'RAM',              suggestions: ['4GB','8GB','16GB','32GB','64GB'] },
        { key: 'storage',     label: 'Storage',          suggestions: ['128GB SSD','256GB SSD','512GB SSD','1TB SSD','2TB SSD','500GB HDD','1TB HDD','2TB HDD'] },
        { key: 'screen',      label: 'Screen Size',      suggestions: ['11 inch','13 inch','13.3 inch','14 inch','15 inch','15.6 inch','16 inch','17 inch'] },
        { key: 'graphics',    label: 'Graphics',         suggestions: ['Integrated','NVIDIA GTX 1650','NVIDIA RTX 3050','NVIDIA RTX 4060','AMD Radeon','Intel Iris Xe'] },
        { key: 'condition',   label: 'Condition',        suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
        { key: 'color',       label: 'Color',            suggestions: ['Silver','Space Gray','Black','White','Gold','Blue','Rose Gold'] },
        { key: 'touchscreen', label: 'Touchscreen',      suggestions: ['Yes','No'] },
        { key: 'os',          label: 'Operating System', suggestions: ['macOS','Windows 11','Windows 10','No OS','Linux','Chrome OS'] },
      ]},
      tvs: { label: 'TVs & Monitors', variants: [
        { key: 'brand',      label: 'Brand',       suggestions: ['Samsung','LG','Sony','Hisense','TCL','Skyworth','Panasonic','Haier'] },
        { key: 'screen',     label: 'Screen Size', suggestions: ['24 inch','32 inch','40 inch','43 inch','50 inch','55 inch','65 inch','75 inch','85 inch'] },
        { key: 'type',       label: 'Type',        suggestions: ['Smart TV','4K UHD','OLED','QLED','LED','Android TV','Monitor','Gaming Monitor'] },
        { key: 'resolution', label: 'Resolution',  suggestions: ['HD (720p)','Full HD (1080p)','4K (2160p)','8K'] },
        { key: 'condition',  label: 'Condition',   suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      audio: { label: 'Audio & Speakers', variants: [
        { key: 'brand',        label: 'Brand',            suggestions: ['Sony','JBL','Bose','Apple','Samsung','Anker','Oraimo','Xiaomi','Marshall'] },
        { key: 'type',         label: 'Type',             suggestions: ['TWS Earbuds','Over-Ear Headphones','On-Ear Headphones','In-Ear Earphones','Bluetooth Speaker','Home Theater','Soundbar','Microphone'] },
        { key: 'color',        label: 'Color',            suggestions: ['Black','White','Blue','Red','Pink','Gray','Green','Gold'] },
        { key: 'connectivity', label: 'Connectivity',     suggestions: ['Bluetooth 5.0','Bluetooth 5.3','Wired 3.5mm','USB-C','True Wireless','NFC'] },
        { key: 'battery_life', label: 'Battery Life',     suggestions: ['Up to 4 hrs','Up to 8 hrs','Up to 12 hrs','Up to 24 hrs','Up to 40 hrs'] },
        { key: 'condition',    label: 'Condition',        suggestions: ['Brand New','UK Used','Nigerian Used'] },
        { key: 'noise_cancel', label: 'Noise Cancelling', suggestions: ['Yes (ANC)','Passive Only','No'] },
      ]},
      cameras: { label: 'Cameras & Photography', variants: [
        { key: 'brand',      label: 'Brand',      suggestions: ['Canon','Nikon','Sony','Fujifilm','GoPro','DJI','Olympus','Panasonic'] },
        { key: 'type',       label: 'Type',       suggestions: ['DSLR','Mirrorless','Action Camera','Drone','Instant Camera','Security Camera','Webcam','Camcorder'] },
        { key: 'megapixels', label: 'Megapixels', suggestions: ['12MP','20MP','24MP','36MP','45MP','61MP','102MP'] },
        { key: 'condition',  label: 'Condition',  suggestions: ['Brand New','UK Used','Nigerian Used'] },
        { key: 'includes',   label: 'Includes',   suggestions: ['Body Only','With Kit Lens','With Multiple Lenses','With Case & Accessories'] },
      ]},
      gaming: { label: 'Gaming', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Console','Game CD/Card','Controller','Gaming Headset','Gaming Chair','Gaming Keyboard','Gaming Mouse','VR Headset'] },
        { key: 'platform',  label: 'Platform',  suggestions: ['PlayStation 5','PlayStation 4','Xbox Series X','Xbox One','Nintendo Switch','PC','Mobile'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Sony','Microsoft','Nintendo','Razer','Logitech','SteelSeries','HyperX'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      accessories_electronics: { label: 'Phone & Laptop Accessories', variants: [
        { key: 'type',       label: 'Type',            suggestions: ['Phone Case','Screen Protector','Charger','Power Bank','Cable (USB-C)','Cable (Lightning)','Cable (Micro-USB)','Adapter','Wireless Charger','Flash Drive','External SSD','Memory Card'] },
        { key: 'brand',      label: 'Brand',           suggestions: ['Apple','Samsung','Anker','Baseus','Ugreen','Oraimo','Romoss','Generic'] },
        { key: 'condition',  label: 'Condition',       suggestions: ['Brand New','UK Used','Nigerian Used'] },
        { key: 'compatible', label: 'Compatible With', suggestions: ['iPhone','Samsung Galaxy','All Android','MacBook','Windows Laptop','Universal'] },
        { key: 'color',      label: 'Color',           suggestions: ['Black','White','Clear','Gold','Silver','Blue','Red'] },
      ]},
      smart_home: { label: 'Smart Home & Gadgets', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Smart Bulb','Smart Plug','Smart Watch','Smart Band','Smart Speaker','Robot Vacuum','Security Camera','Doorbell Camera','Smart Lock','Drone'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Xiaomi','Amazon','Google','Samsung','Apple','Philips','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      printers_scanners: { label: 'Printers & Scanners', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Inkjet Printer','Laser Printer','3-in-1 Printer','Photo Printer','Scanner','Photocopier'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['HP','Canon','Epson','Brother','Samsung','Ricoh'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      networking: { label: 'Networking & Internet', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['WiFi Router','MiFi/Hotspot','Ethernet Cable','Network Switch','Modem','Antenna','Data SIM'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['TP-Link','Huawei','Netgear','MTN','Airtel','Glo','9Mobile'] },
        { key: 'speed',     label: 'Speed',     suggestions: ['4G','5G','WiFi 5','WiFi 6','100Mbps','1Gbps'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
    }
  },

  computing: {
    label: 'Computing', icon: '[Computing]',
    subcategories: {
      laptops_computing: { label: 'Laptops', variants: [
        { key: 'brand',     label: 'Brand',     suggestions: ['Apple','Dell','HP','Lenovo','Asus','Acer','Microsoft'] },
        { key: 'processor', label: 'Processor', suggestions: ['Intel i3','Intel i5','Intel i7','M1','M2','Ryzen 5','Ryzen 7'] },
        { key: 'ram',       label: 'RAM',       suggestions: ['4GB','8GB','16GB','32GB'] },
        { key: 'storage',   label: 'Storage',   suggestions: ['256GB SSD','512GB SSD','1TB SSD','1TB HDD'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
      ]},
      textbooks: { label: 'Textbooks & Course Materials', variants: [
        { key: 'department', label: 'Department', suggestions: ['Engineering','Medicine','Law','Science','Arts','Business','Education','Agriculture','Pharmacy','Architecture','Social Sciences','Mass Communication','Nursing'] },
        { key: 'level',      label: 'Level',      suggestions: ['100 Level','200 Level','300 Level','400 Level','500 Level','600 Level','Postgraduate'] },
        { key: 'course',     label: 'Course',     suggestions: [] },
        { key: 'author',     label: 'Author',     suggestions: [] },
        { key: 'edition',    label: 'Edition',    suggestions: ['1st','2nd','3rd','4th','5th','Latest'] },
        { key: 'condition',  label: 'Condition',  suggestions: ['Brand New','Very Good','Good','Fair','Heavily Used'] },
        { key: 'type',       label: 'Type',       suggestions: ['Hardcover','Paperback','Past Questions','Lab Manual','Handouts','Lecture Notes','Study Guide'] },
      ]},
      stationery: { label: 'Stationery & School Supplies', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Pen','Pencil','Notebook','Jotter','File Folder','Calculator','Drawing Kit','Lab Coat','Ruler','Compass','Eraser','Highlighter','Stapler','Printer Paper'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Casio','Staedtler','Bic','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Good Condition'] },
      ]},
      accessories_computing: { label: 'Computer Accessories', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Keyboard','Mouse','Monitor','Webcam','Headset','USB Hub','Laptop Bag','Mouse Pad','Cable','Cooling Pad','Docking Station'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Logitech','HP','Dell','Anker','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
    }
  },

  fashion: {
    label: 'Fashion', icon: '[Fashion]',
    subcategories: {
      mens_wear: { label: "Men's Clothing", variants: [
        { key: 'type',      label: 'Type',      suggestions: ['T-Shirt','Polo Shirt','Casual Shirt','Formal Shirt','Trousers','Jeans','Shorts','Joggers','Suit','Blazer','Jacket','Hoodie','Sweater','Agbada','Senator/Kaftan','Native Wear','Track Suit','Singlet','Boxer Shorts'] },
        { key: 'size',      label: 'Size',      suggestions: ['XS','S','M','L','XL','XXL','XXXL','4XL','Free Size'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','White','Navy Blue','Gray','Brown','Khaki','Green','Red','Blue','Ash','Cream','Wine','Multi-color'] },
        { key: 'material',  label: 'Material',  suggestions: ['Cotton','Polyester','Denim','Linen','Silk','Wool','Ankara','Aso-oke','Fleece'] },
        { key: 'fit',       label: 'Fit',       suggestions: ['Slim Fit','Regular Fit','Relaxed Fit','Oversized','Baggy'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Zara','H&M','Ralph Lauren','Tommy Hilfiger','Gucci','Local Brand','No Brand'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      womens_wear: { label: "Women's Clothing", variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Dress','Gown','Blouse','Top','Crop Top','Shirt','Skirt (Mini)','Skirt (Midi)','Skirt (Maxi)','Trousers','Jeans','Leggings','Jumpsuit','Romper','Co-ord Set','Iro & Buba','Ankara Dress','Lace Dress','Corset','Bodysuit','Lingerie','Night Wear'] },
        { key: 'size',      label: 'Size',      suggestions: ['XS','S','M','L','XL','XXL','XXXL','Free Size','UK 6','UK 8','UK 10','UK 12','UK 14','UK 16'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','White','Pink','Red','Blue','Yellow','Green','Nude/Beige','Floral','Multi-color','Animal Print','Striped'] },
        { key: 'material',  label: 'Material',  suggestions: ['Cotton','Polyester','Silk','Lace','Ankara','Chiffon','Denim','Satin','Velvet','Knit','Jersey'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Zara','H&M','ASOS','Pretty Little Thing','Shein','Fashion Nova','Local Brand','No Brand'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        { key: 'style',     label: 'Style',     suggestions: ['Casual','Formal','Party/Occasion','Streetwear','Modest/Hijab-friendly','Gym/Activewear'] },
      ]},
      mens_shoes: { label: "Men's Shoes", variants: [
        { key: 'size',      label: 'Size (UK)', suggestions: ['6','7','7.5','8','8.5','9','9.5','10','10.5','11','12','13'] },
        { key: 'type',      label: 'Type',      suggestions: ['Sneakers','Loafers','Oxford Shoes','Derby Shoes','Chelsea Boots','Sandals','Slippers/Slides','Work Boots','Basketball Shoes','Running Shoes','Dress Shoes'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Puma','New Balance','Converse','Vans','Jordan','Timberland','Clark','Local Brand','No Brand'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','White','Brown','Tan','Gray','Navy','Red','Multi'] },
        { key: 'material',  label: 'Material',  suggestions: ['Leather','Suede','Canvas','Mesh','Synthetic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      womens_shoes: { label: "Women's Shoes", variants: [
        { key: 'size',      label: 'Size (UK)', suggestions: ['3','4','4.5','5','5.5','6','6.5','7','7.5','8','9'] },
        { key: 'type',      label: 'Type',      suggestions: ['Heels (Block)','Heels (Stiletto)','Heels (Kitten)','Sneakers','Sandals','Flat Shoes','Loafers','Boots (Ankle)','Boots (Knee-high)','Slippers/Slides','Platform Shoes','Mules','Wedge Heels'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Steve Madden','Zara','H&M','Local Brand','No Brand'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','Nude/Beige','White','Brown','Red','Pink','Gold','Silver','Multi'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      bags: { label: 'Bags & Backpacks', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Handbag','Shoulder Bag','Crossbody Bag','Backpack','Laptop Bag','Tote Bag','Clutch','Mini Bag','Waist/Fanny Pack','Duffel Bag','Travel/Luggage Bag','Briefcase','School Bag'] },
        { key: 'gender',    label: 'For',      suggestions: ['Women','Men','Unisex','Kids'] },
        { key: 'color',     label: 'Color',    suggestions: ['Black','Brown','Tan','White','Red','Navy','Gray','Multi','Nude'] },
        { key: 'material',  label: 'Material', suggestions: ['Genuine Leather','PU Leather','Canvas','Fabric','Nylon','Jute'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['Gucci','Louis Vuitton','Michael Kors','Coach','Zara','H&M','Local Brand','No Brand'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      watches_jewelry: { label: 'Watches & Jewelry', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Smartwatch','Analog Watch','Digital Watch','Necklace','Bracelet','Earrings','Ring','Anklet','Chain','Waist Beads','Brooch'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['Apple','Samsung','Casio','Rolex','Seiko','Guess','Hublot','Cartier','Generic'] },
        { key: 'gender',    label: 'For',      suggestions: ['Men','Women','Unisex'] },
        { key: 'material',  label: 'Material', suggestions: ['Gold-plated','Silver-plated','Stainless Steel','Rose Gold','Copper','Beads','Leather Strap','Silicone'] },
        { key: 'color',     label: 'Color',    suggestions: ['Gold','Silver','Rose Gold','Black','Multi'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      fashion_accessories: { label: 'Fashion Accessories', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Belt','Cap/Hat','Sunglasses','Scarf/Stole','Tie','Bow Tie','Wallet','Socks','Underwear','Bra','Beanie','Beret','Hijab/Veil','Gloves','Bucket Hat','Baseball Cap'] },
        { key: 'gender',    label: 'For',      suggestions: ['Men','Women','Unisex'] },
        { key: 'color',     label: 'Color',    suggestions: ['Black','Brown','Gold','Silver','Multi','Clear','White','Tan'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['Nike','Adidas','Gucci','Generic','No Brand'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      uniforms_costumes: { label: 'Uniforms & Costumes', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Lab Coat','Safety Gear','Hospital Scrubs','School Uniform','Cultural Attire','Theatre Costume','Sports Kit'] },
        { key: 'size',      label: 'Size',     suggestions: ['XS','S','M','L','XL','XXL'] },
        { key: 'color',     label: 'Color',    suggestions: ['White','Blue','Green','Navy','Multi'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','Nigerian Used'] },
      ]},
      wigs_hair: { label: 'Wigs, Hair & Extensions', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Lace Front Wig','Full Lace Wig','Closure Wig','Braided Wig','Hair Weave','Crochet Hair','Clip-in Extensions','Ponytail Extension','Natural Hair','Dreadlock Extensions'] },
        { key: 'length',    label: 'Length',    suggestions: ['8 inch','10 inch','12 inch','14 inch','16 inch','18 inch','20 inch','22 inch','24 inch','26 inch','28 inch','30 inch'] },
        { key: 'color',     label: 'Color',     suggestions: ['1B (Natural Black)','1 (Jet Black)','Blonde','Brown','Burgundy/Wine','Ombre','Grey','613 (Platinum)','Colored'] },
        { key: 'texture',   label: 'Texture',   suggestions: ['Straight','Body Wave','Deep Wave','Curly','Kinky Curly','Loose Wave','Water Wave','Afro Kinky'] },
        { key: 'hair_type', label: 'Hair Type', suggestions: ['Human Hair','Synthetic','Remy Human Hair','Virgin Hair','Blend'] },
        { key: 'density',   label: 'Density',   suggestions: ['130%','150%','180%','200%','250%'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Used Once','Good Condition'] },
      ]},
    }
  },

  home_kitchen: {
    label: 'Home & Kitchen', icon: '[Home]',
    subcategories: {
      furniture: { label: 'Furniture', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Bed Frame','Mattress','Chair','Study Desk','Dining Table','Wardrobe','Sofa','Shelf/Bookcase','TV Stand','Chest of Drawers','Ottoman','Bunk Bed','Baby Crib'] },
        { key: 'material',  label: 'Material', suggestions: ['Solid Wood','MDF Wood','Metal','Plastic','Rattan/Bamboo','Upholstered Fabric','Foam'] },
        { key: 'color',     label: 'Color',    suggestions: ['Brown','Black','White','Gray','Natural Wood','Cream','Dark Walnut'] },
        { key: 'size',      label: 'Size',     suggestions: ['Single (3ft)','Double (4ft)','Queen (5ft)','King (6ft)','Small','Medium','Large','Custom'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
        { key: 'assembly',  label: 'Assembly', suggestions: ['Pre-assembled','Self-assembly (with manual)'] },
      ]},
      kitchen_appliances: { label: 'Kitchen Appliances', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Blender','Juicer','Microwave','Gas Cooker (2 burner)','Gas Cooker (4 burner)','Electric Cooker','Induction Cooker','Air Fryer','Electric Kettle','Electric Iron','Toaster','Rice Cooker','Slow Cooker','Food Processor','Stand Mixer','Hand Mixer','Coffee Maker','Deep Fryer'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['LG','Samsung','Haier','Nexus','Thermocool','Binatone','Philips','Midea','Panasonic','Scanfrost','Polystar','Generic'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','White','Silver','Red','Stainless Steel'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Good Working Condition'] },
        { key: 'voltage',   label: 'Voltage',   suggestions: ['220V (Nigeria)','110V','Dual Voltage'] },
      ]},
      refrigerators_freezers: { label: 'Fridges & Freezers', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Single Door Fridge','Double Door Fridge','Side-by-Side Fridge','Chest Freezer','Upright Freezer','Wine Cooler','Mini Fridge'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['LG','Samsung','Haier','Thermocool','Hisense','Nexus','Polystar','Scanfrost','Midea'] },
        { key: 'capacity',  label: 'Capacity', suggestions: ['50L','100L','150L','200L','250L','300L','350L','400L+'] },
        { key: 'color',     label: 'Color',    suggestions: ['Silver','White','Black','Stainless Steel'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used','Good Working Condition'] },
      ]},
      bedding_bath: { label: 'Bedding & Bath', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Pillow','Duvet','Duvet Cover','Bed Sheet Set','Mattress Protector','Blanket','Throw','Towel Set','Bath Mat','Curtain','Mosquito Net'] },
        { key: 'size',      label: 'Size',     suggestions: ['Single (3ft)','Double (4ft)','Queen (5ft)','King (6ft)','Free Size'] },
        { key: 'color',     label: 'Color',    suggestions: ['White','Gray','Blue','Pink','Multi','Striped','Plain'] },
        { key: 'material',  label: 'Material', suggestions: ['100% Cotton','Microfiber','Polyester','Bamboo','Flannel','Egyptian Cotton'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','Nigerian Used','Good Condition'] },
      ]},
      home_decor: { label: 'Home Decor & Lighting', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['LED Bulb','Table Lamp','Floor Lamp','String Lights','Ceiling Light','Wall Art','Picture Frame','Mirror','Rug/Carpet','Curtains','Cushion/Throw Pillow','Clock','Vase','Plant Pot','Candle Holder','Doormat'] },
        { key: 'color',     label: 'Color',    suggestions: ['Warm White','Cool White','RGB/Multi-color','Black','Gold','Silver','Natural'] },
        { key: 'material',  label: 'Material', suggestions: ['Metal','Wood','Glass','Fabric','Plastic','Ceramic'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      cleaning_laundry: { label: 'Cleaning & Laundry', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Washing Machine','Spin Dryer','Iron','Steam Iron','Vacuum Cleaner','Mop & Bucket','Broom Set','Cleaning Spray','Disinfectant','Laundry Basket','Drying Rack','Ironing Board'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['LG','Samsung','Midea','Haier','Thermocool','Generic'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','UK Used','Nigerian Used','Good Working Condition'] },
      ]},
      cookware_utensils: { label: 'Cookware & Kitchen Tools', variants: [
        { key: 'type',      label: 'Type',     suggestions: ['Pot Set','Non-Stick Pan','Cast Iron Pot','Pressure Cooker','Wok','Baking Tray','Mixing Bowl','Cutlery Set','Plates & Cups','Storage Containers','Kitchen Knife','Cutting Board','Colander','Serving Spoon','Mortar & Pestle'] },
        { key: 'material',  label: 'Material', suggestions: ['Stainless Steel','Non-Stick Coated','Cast Iron','Aluminum','Ceramic','Plastic','Glass'] },
        { key: 'brand',     label: 'Brand',    suggestions: ['Tefal','Scanpan','Meyer','Local Brand','Generic'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','Nigerian Used','Good Condition'] },
      ]},
    }
  },

  groceries: {
    label: 'Food & Groceries', icon: '[Food]',
    subcategories: {
      cooked_food: { label: 'Cooked Food & Meals', variants: [
        { key: 'meal_type',   label: 'Meal Type',   suggestions: ['Rice','Jollof Rice','Fried Rice','Beans','Porridge Yam','Amala','Eba/Garri','Semovita','Pounded Yam','Egusi Soup','Okro Soup','Pepper Soup','Pasta/Spaghetti','Noodles','Salad','Sandwich','Shawarma','Chicken','Grilled Fish','Small Chops','Pizza','Burger'] },
        { key: 'portion',     label: 'Portion',     suggestions: ['Small Plate','Medium Plate','Large Plate','Full Pot','Per Pack','Per Piece'] },
        { key: 'spice_level', label: 'Spice Level', suggestions: ['Mild','Medium','Hot','Very Hot','No Spice'] },
        { key: 'protein',     label: 'Protein',     suggestions: ['Chicken','Fish','Beef','Turkey','Goat','Egg','No Protein','Vegetarian'] },
        { key: 'delivery',    label: 'Delivery',    suggestions: ['Delivery Available','Pickup Only'] },
      ]},
      snacks_drinks: { label: 'Snacks & Drinks', variants: [
        { key: 'type',    label: 'Type',      suggestions: ['Chapman','Zobo','Kunu','Smoothie','Juice','Soft Drink','Bottled Water','Milkshake','Puff-Puff','Chin-Chin','Meat Pie','Spring Roll','Egg Roll','Doughnut','Cake Slice','Moi-Moi','Akara','Biscuit','Popcorn','Chocolate'] },
        { key: 'size',    label: 'Size/Pack', suggestions: ['Single','Pack of 2','Pack of 4','Pack of 6','1 Litre','500ml','250ml','Per Kg'] },
        { key: 'flavor',  label: 'Flavor',    suggestions: ['Original','Strawberry','Chocolate','Vanilla','Mango','Orange','Mixed Fruit','Spicy'] },
        { key: 'dietary', label: 'Dietary',   suggestions: ['Halal','Vegan','Vegetarian','No Preservatives','Gluten-Free','Dairy-Free'] },
      ]},
      raw_ingredients: { label: 'Raw Food & Ingredients', variants: [
        { key: 'type',     label: 'Type',     suggestions: ['Rice (bag)','Beans','Garri','Yam','Plantain','Tomatoes','Pepper','Onion','Vegetable Oil','Palm Oil','Seasoning Cubes','Spices','Flour','Semolina','Oats','Canned Food','Pasta/Noodles','Groundnut','Frozen Fish','Frozen Chicken','Stockfish'] },
        { key: 'quantity', label: 'Quantity', suggestions: ['250g','500g','1kg','2kg','5kg','10kg','25kg','50kg','Per Cup','Per Piece'] },
        { key: 'origin',   label: 'Origin',   suggestions: ['Local Farm','Imported','Organic','Processed'] },
      ]},
      bakery: { label: 'Bakery & Pastries', variants: [
        { key: 'type',    label: 'Type',    suggestions: ['Bread Loaf','Sliced Bread','Agege Bread','Birthday Cake','Chin-Chin (bulk)','Cupcakes','Doughnut (box)','Croissant','Meat Pie (bulk)','Shawarma Bread','Custom Cake'] },
        { key: 'flavor',  label: 'Flavor',  suggestions: ['Plain','Chocolate','Red Velvet','Vanilla','Strawberry','Mixed Fruit','Carrot','Marble'] },
        { key: 'size',    label: 'Size',    suggestions: ['Small','Medium','Large','Jumbo','Per Piece','Box of 6','Box of 12'] },
        { key: 'dietary', label: 'Dietary', suggestions: ['Halal','Vegan','No Sugar','Gluten-Free'] },
      ]},
      household_consumables: { label: 'Household Consumables', variants: [
        { key: 'type',  label: 'Type',      suggestions: ['Toilet Tissue','Paper Towel','Soap','Detergent','Dish Wash','Air Freshener','Insecticide','Mosquito Coil','Candles','Matches','Garbage Bags','Toothbrush','Toothpaste','Shampoo','Body Wash'] },
        { key: 'brand', label: 'Brand',     suggestions: ['Ariel','Omo','Dettol','Harpic','Zip','Delta','Generic'] },
        { key: 'size',  label: 'Pack Size', suggestions: ['Single','Pack of 2','Pack of 4','Pack of 6','Bulk/Economy Size'] },
      ]},
    }
  },

  beauty: {
    label: 'Beauty & Health', icon: '[Beauty]',
    subcategories: {
      skincare: { label: 'Skincare', variants: [
        { key: 'type',      label: 'Type',         suggestions: ['Moisturizer','Toner','Face Wash/Cleanser','Serum','Sunscreen (SPF)','Face Mask','Exfoliator/Scrub','Eye Cream','Lip Balm','Toning Lotion','Body Lotion','Body Oil','Stretch Mark Cream'] },
        { key: 'skin_type', label: 'Skin Type',    suggestions: ['All Skin Types','Oily Skin','Dry Skin','Combination Skin','Sensitive Skin','Dark Skin'] },
        { key: 'concern',   label: 'Skin Concern', suggestions: ['Brightening','Anti-aging','Acne/Pimples','Hyperpigmentation','Dark Spots','Moisturizing','Firming'] },
        { key: 'brand',     label: 'Brand',        suggestions: ['CeraVe','Neutrogena','Olay','Nivea','Vaseline','Fair & White','Caro White','Ebony','Bio Claire','Local Brand'] },
        { key: 'size',      label: 'Size',         suggestions: ['50ml','100ml','150ml','200ml','250ml','500ml','1 Litre'] },
        { key: 'condition', label: 'Condition',    suggestions: ['Brand New (Sealed)','Brand New (Opened Box)'] },
      ]},
      makeup: { label: 'Makeup & Cosmetics', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Foundation','Concealer','BB Cream','Powder','Blush','Highlighter','Contour','Eyeshadow Palette','Eyeliner','Mascara','Eyebrow Pencil','Lipstick','Lip Gloss','Lip Liner','Setting Spray','Primer','Makeup Brush Set','Beauty Blender'] },
        { key: 'shade',     label: 'Shade',     suggestions: ['Light/Fair','Medium','Tan','Deep/Dark','Ebony','Universal/Buildable'] },
        { key: 'finish',    label: 'Finish',    suggestions: ['Matte','Glossy','Satin','Dewy','Natural'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['MAC','Fenty Beauty','NYX','Maybelline','Revlon','e.l.f.','Huda Beauty','Charlotte Tilbury','Local Brand'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New (Sealed)'] },
      ]},
      haircare: { label: 'Haircare Products', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Shampoo','Conditioner','Deep Conditioner','Hair Mask','Hair Oil','Leave-in Conditioner','Edge Control','Hair Relaxer','Hair Color/Dye','Hair Growth Serum','Scalp Treatment','Dry Shampoo','Hair Gel','Texturizer'] },
        { key: 'hair_type', label: 'Hair Type', suggestions: ['All Hair Types','Natural Hair','Relaxed Hair','Dry Hair','Oily Scalp','4C Hair','Curly Hair','Colored/Treated Hair'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Dark & Lovely','ORS','Cantu','Shea Moisture','Dove','Pantene','Head & Shoulders','SoftSheen-Carson','Local Brand'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New (Sealed)'] },
      ]},
      fragrances: { label: 'Perfumes & Fragrances', variants: [
        { key: 'type',      label: 'Type',         suggestions: ['Eau de Parfum (EDP)','Eau de Toilette (EDT)','Body Mist','Roll-on Perfume','Deodorant','Attar/Oil Perfume','Home Fragrance'] },
        { key: 'gender',    label: 'For',          suggestions: ['Men','Women','Unisex'] },
        { key: 'scent',     label: 'Scent Family', suggestions: ['Floral','Fruity','Woody/Musky','Fresh/Aquatic','Oriental/Spicy','Sweet/Gourmand','Citrus'] },
        { key: 'brand',     label: 'Brand',        suggestions: ['Dior','Chanel','YSL','Versace','Armani','Davidoff','Hugo Boss','Victoria Secret','Arabian Oud','Al Haramain','Generic/Clone'] },
        { key: 'size',      label: 'Size',         suggestions: ['10ml','30ml','50ml','75ml','100ml','200ml'] },
        { key: 'condition', label: 'Condition',    suggestions: ['Brand New (Sealed)','Brand New (Opened)','Used (Over 50%)','Used (Under 50%)'] },
      ]},
      health_wellness: { label: 'Health & Wellness', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Vitamins & Supplements','Pain Relief','First Aid Kit','Blood Pressure Monitor','Glucose Meter','Thermometer','Pulse Oximeter','Pregnancy Test','Condoms','Sanitary Pads','Tampons','Glasses/Spectacles','Herbal Supplement','Protein Powder','Multivitamins'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Seven Seas','Centrum','Emzor','Swiss Pharma','GNC','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New (Sealed)'] },
      ]},
      salon_tools: { label: 'Salon & Grooming Tools', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Hair Dryer','Flat Iron/Straightener','Curling Wand','Hair Clipper','Trimmer','Electric Shaver','Nail Drill','UV Nail Lamp','Makeup Mirror','Tweezer Set','Eyebrow Razor','Epilator','Facial Steamer','Derma Roller','Manicure/Pedicure Kit'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Remington','Philips','BaByliss','Wahl','Nova','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
    }
  },

  sports: {
    label: 'Sports & Fitness', icon: '[Sports]',
    subcategories: {
      gym_fitness: { label: 'Gym & Fitness Equipment', variants: [
        { key: 'type',      label: 'Type',        suggestions: ['Dumbbell (pair)','Barbell','Weight Plates','Resistance Bands','Jump Rope','Yoga Mat','Pull-up Bar','Bench Press','Treadmill','Exercise Bike','Rowing Machine','Kettlebell','Foam Roller','Ab Wheel','Push-up Handles'] },
        { key: 'weight',    label: 'Weight (kg)', suggestions: ['2kg','5kg','10kg','15kg','20kg','25kg','30kg','50kg'] },
        { key: 'material',  label: 'Material',    suggestions: ['Rubber Coated','Chrome','Cast Iron','Neoprene','Steel','Foam'] },
        { key: 'condition', label: 'Condition',   suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
      ]},
      jerseys_sportswear: { label: 'Jerseys & Sportswear', variants: [
        { key: 'type',         label: 'Type',         suggestions: ['Football Jersey','Basketball Jersey','Running Shorts','Sports T-shirt','Track Suit','Compression Shorts','Cycling Shorts','Swim Trunks','Sports Bra','Leggings','Windbreaker','Football Socks'] },
        { key: 'club',         label: 'Club/Team',    suggestions: ['Manchester United','Chelsea','Arsenal','Liverpool','Real Madrid','Barcelona','PSG','Bayern Munich','Juventus','Nigeria Super Eagles','Other'] },
        { key: 'size',         label: 'Size',         suggestions: ['XS','S','M','L','XL','XXL'] },
        { key: 'condition',    label: 'Condition',    suggestions: ['Brand New','UK Used','Nigerian Used'] },
        { key: 'authenticity', label: 'Authenticity', suggestions: ['Original/Authentic','Replica/Clone'] },
      ]},
      sports_shoes: { label: 'Sports Shoes', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Football Boots','Running Shoes','Basketball Shoes','Training Shoes','Tennis Shoes','Cycling Shoes','Hiking Boots'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Puma','Under Armour','New Balance','Asics','Reebok'] },
        { key: 'size',      label: 'Size (UK)', suggestions: ['6','7','8','9','10','11','12'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      sports_equipment: { label: 'Sports Equipment & Gear', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Football','Basketball','Tennis Racket','Table Tennis Set','Badminton Set','Volleyball','Boxing Gloves','Punching Bag','Swimming Goggles','Chess Set','Bicycle','Helmet','Knee Pads','Shin Guards'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Wilson','Head','Spalding','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
      ]},
    }
  },

  vehicles: {
    label: 'Vehicles & Transport', icon: '[Vehicles]',
    subcategories: {
      bicycles: { label: 'Bicycles', variants: [
        { key: 'type',      label: 'Type',       suggestions: ['Mountain Bike','Road Bike','BMX','Folding Bike','City/Commuter Bike','Kids Bike','Electric Bike'] },
        { key: 'brand',     label: 'Brand',      suggestions: ['Trek','Giant','Shimano','Generic','Local Assembly'] },
        { key: 'size',      label: 'Wheel Size', suggestions: ['20 inch','24 inch','26 inch','27.5 inch','29 inch'] },
        { key: 'color',     label: 'Color',      suggestions: ['Black','Red','Blue','White','Green','Multi'] },
        { key: 'condition', label: 'Condition',  suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
      ]},
      car_accessories: { label: 'Car Accessories', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Car Seat Cover','Car Perfume','Dash Cam','Car Phone Holder','Jump Starter','Tyre Pump','Car Polish','Steering Wheel Cover','Floor Mat','Car Charger','Reverse Camera','GPS Tracker'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Generic','Baseus','Anker','Local Brand'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
      ]},
      motorcycles_scooters: { label: 'Motorcycles & Scooters', variants: [
        { key: 'brand',     label: 'Brand',     suggestions: ['Bajaj','Suzuki','Honda','Yamaha','Qlink','Jincheng','TVS','Generic'] },
        { key: 'type',      label: 'Type',      suggestions: ['Sports Bike','Commuter Bike','Dirt Bike','Tricycle (Keke)','Scooter'] },
        { key: 'engine',    label: 'Engine',    suggestions: ['50cc','100cc','125cc','150cc','200cc','250cc'] },
        { key: 'color',     label: 'Color',     suggestions: ['Black','Red','Blue','White','Silver'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Nigerian Used','Good Condition'] },
      ]},
    }
  },

  books: {
    label: 'Books & Stationery', icon: '[Books]',
    subcategories: {
      academic_books: { label: 'Academic Books', variants: [
        { key: 'department', label: 'Department',       suggestions: ['Engineering','Medicine','Law','Science','Arts','Business','Education','Agriculture','Pharmacy','Architecture','Social Sciences','Mass Communication','Nursing','Accounting','Economics'] },
        { key: 'level',      label: 'Level',            suggestions: ['100 Level','200 Level','300 Level','400 Level','500 Level','600 Level','Postgraduate'] },
        { key: 'course',     label: 'Course Code/Name', suggestions: [] },
        { key: 'author',     label: 'Author',           suggestions: [] },
        { key: 'edition',    label: 'Edition',          suggestions: ['1st Edition','2nd Edition','3rd Edition','4th Edition','5th Edition','Latest Edition'] },
        { key: 'format',     label: 'Format',           suggestions: ['Hardcover','Paperback','PDF/Softcopy','Photocopy'] },
        { key: 'condition',  label: 'Condition',        suggestions: ['Brand New','Good','Fair','Heavily Used'] },
      ]},
      past_questions: { label: 'Past Questions & Study Guides', variants: [
        { key: 'type',    label: 'Type',          suggestions: ['University Past Questions','JAMB Past Questions','WAEC/NECO Past Questions','Study Guide','Lecture Note','Handout','Summary Sheet','Practice Problems'] },
        { key: 'subject', label: 'Subject',       suggestions: ['Mathematics','Physics','Chemistry','Biology','English','Economics','Government','Literature','Commerce','Agriculture'] },
        { key: 'years',   label: 'Years Covered', suggestions: ['Last 5 Years','Last 10 Years','Last 15 Years','All Available'] },
        { key: 'format',  label: 'Format',        suggestions: ['Printed Booklet','PDF Softcopy','WhatsApp/Telegram Link'] },
      ]},
      fiction_novels: { label: 'Fiction & Novels', variants: [
        { key: 'genre',     label: 'Genre',     suggestions: ['Romance','Thriller/Mystery','Sci-Fi','Fantasy','African Literature','Horror','Adventure','Historical Fiction','Self-help','Biography','Business','Religious/Christian','Islamic'] },
        { key: 'author',    label: 'Author',    suggestions: ['Chinua Achebe','Chimamanda Ngozi Adichie','Wole Soyinka','Ben Okri','Helon Habila','Stephen King','John Grisham','Nora Roberts','Other'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Good','Fair'] },
        { key: 'format',    label: 'Format',    suggestions: ['Paperback','Hardcover','E-book'] },
      ]},
      stationery_supplies: { label: 'Stationery & Supplies', variants: [
        { key: 'type',     label: 'Type',     suggestions: ['Pen (biro)','Pencil','Notepad/Jotter','A4 Ruled Notebook','Graph Paper','Drawing Set','Calculator (scientific)','Ruler','Set Square','Protractor','Eraser','Sharpener','Highlighter (set)','Correction Fluid','File Folder','Binder','Stapler','Hole Punch','Scissors','Glue Stick','Tape','Post-it Notes','Index Cards','Printer Paper (A4 ream)'] },
        { key: 'brand',    label: 'Brand',    suggestions: ['Casio','Staedtler','Bic','Pilot','Pentel','Generic'] },
        { key: 'quantity', label: 'Quantity', suggestions: ['Single','Pack of 5','Pack of 10','Box/Pack','Bulk (50+)'] },
      ]},
    }
  },

  tickets: {
    label: 'Tickets & Events', icon: '[Tickets]',
    subcategories: {
      concert_show: { label: 'Concert & Show Tickets', variants: [
        { key: 'event',       label: 'Event Name',  suggestions: [] },
        { key: 'date',        label: 'Event Date',  suggestions: [] },
        { key: 'venue',       label: 'Venue',       suggestions: [] },
        { key: 'ticket_type', label: 'Ticket Type', suggestions: ['Regular','VIP','VVIP','Table','Online Stream'] },
        { key: 'quantity',    label: 'Quantity',    suggestions: ['1 Ticket','2 Tickets','3 Tickets','4 Tickets','5+'] },
      ]},
      academic_events: { label: 'Academic Events & Conferences', variants: [
        { key: 'type',   label: 'Type',   suggestions: ['Workshop','Seminar','Conference','Bootcamp','Hackathon','Career Fair','Networking Event','Training'] },
        { key: 'field',  label: 'Field',  suggestions: ['Tech','Business','Medicine','Law','Engineering','Finance','Arts','Science'] },
        { key: 'format', label: 'Format', suggestions: ['Physical','Online/Virtual','Hybrid'] },
        { key: 'date',   label: 'Date',   suggestions: [] },
      ]},
      sport_tickets: { label: 'Sports Event Tickets', variants: [
        { key: 'sport',       label: 'Sport',    suggestions: ['Football','Basketball','Tennis','Athletics','Boxing','Swimming'] },
        { key: 'event',       label: 'Event',    suggestions: [] },
        { key: 'ticket_type', label: 'Stand',    suggestions: ['Terrace','Regular Stand','VIP Stand','Box'] },
        { key: 'quantity',    label: 'Quantity', suggestions: ['1 Ticket','2 Tickets','3+'] },
      ]},
    }
  },

  kids: {
    label: 'Kids & Baby', icon: '[Kids]',
    subcategories: {
      toys_games: { label: 'Toys & Games', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Action Figure','Doll','Building Blocks (LEGO)','Board Game','Puzzle','Remote Control Car','Stuffed Animal','Educational Toy','Outdoor Toy','Art & Craft Kit','Musical Toy','Baby Rattle','Video Game'] },
        { key: 'age',       label: 'Age Group', suggestions: ['0-2 Years','3-5 Years','6-8 Years','9-12 Years','13+ Years'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Nigerian Used','Good Condition'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['LEGO','Fisher-Price','Mattel','Hasbro','Generic'] },
      ]},
      baby_clothing: { label: 'Baby & Kids Clothing', variants: [
        { key: 'age',       label: 'Age/Size', suggestions: ['0-3 months','3-6 months','6-12 months','12-18 months','18-24 months','2 Years','3 Years','4 Years','5 Years','6-7 Years','8-10 Years','11-13 Years'] },
        { key: 'type',      label: 'Type',     suggestions: ['Onesie/Romper','Top & Bottom Set','Dress','Trousers','Jacket','Sleepsuit','School Uniform','Traditional Wear','Swimwear','Socks & Shoes Set'] },
        { key: 'gender',    label: 'For',      suggestions: ['Boy','Girl','Unisex/Both'] },
        { key: 'condition', label: 'Condition',suggestions: ['Brand New','Good Condition','Nigerian Used'] },
      ]},
      baby_gear: { label: 'Baby Gear & Equipment', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Stroller/Pram','Car Seat','Baby Carrier/Sling','Baby Cot/Crib','Bouncer','High Chair','Baby Walker','Baby Monitor','Breast Pump','Baby Swing','Potty Trainer','Baby Bath Tub','Diaper Bag'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Chicco','Graco','Mamas & Papas','Maclaren','Generic'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
      ]},
    }
  },

  arts_crafts: {
    label: 'Arts & Crafts', icon: '[Arts]',
    subcategories: {
      art_supplies: { label: 'Art Supplies', variants: [
        { key: 'type',      label: 'Type',      suggestions: ['Canvas','Acrylic Paint Set','Oil Paint Set','Watercolor Set','Brushes Set','Easel','Sketch Pad','Charcoal/Graphite Set','Palette','Spray Paint','Fabric Paint','Epoxy Resin Kit','Airbrush Kit'] },
        { key: 'brand',     label: 'Brand',     suggestions: ['Daler-Rowney','Winsor & Newton','Generic/Local'] },
        { key: 'condition', label: 'Condition', suggestions: ['Brand New','Good Condition'] },
      ]},
      handmade_crafts: { label: 'Handmade & Custom Items', variants: [
        { key: 'type',     label: 'Type',     suggestions: ['Handmade Jewelry','Beaded Accessories','Scented Candle','Embroidery','Crochet/Knit Items','Custom Portrait','Clay Art','Tie-dye Clothing','Custom T-shirt (print)','Decorated Shoes','Resin Art','Gift Hamper'] },
        { key: 'material', label: 'Material', suggestions: ['Beads','Clay','Resin','Cotton','Wax','Leather','Wood'] },
      ]},
      musical_instruments: { label: 'Musical Instruments', variants: [
        { key: 'type',      label: 'Instrument', suggestions: ['Guitar (Acoustic)','Guitar (Electric)','Bass Guitar','Keyboard/Piano','Drum Set','Drum Pad','Violin','Trumpet','Saxophone','Ukulele','Flute','Cajon','DJ Controller','Audio Interface','Microphone (Studio)'] },
        { key: 'brand',     label: 'Brand',      suggestions: ['Yamaha','Roland','Fender','Gibson','Korg','Casio','Generic'] },
        { key: 'condition', label: 'Condition',  suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
      ]},
    }
  },
}

// -- Seeding logic -------------------------------------------------------------

async function main() {
  console.log('[SEED] Seeding category attributes...\n')

  let totalSeeded = 0
  let totalSubcategories = 0

  for (const [categoryKey, cat] of Object.entries(CATEGORY_TREE)) {
    for (const [subcategoryKey, sub] of Object.entries(cat.subcategories)) {
      totalSubcategories++
      let count = 0

      for (let i = 0; i < sub.variants.length; i++) {
        const v = sub.variants[i]

        // Determine type
        let type = 'text'
        if (v.suggestions && v.suggestions.length > 0) {
          type = ['color', 'features', 'includes', 'dietary', 'amenities', 'accessories'].includes(v.key)
            ? 'multi_select'
            : 'select'
        }

        // Free-text fields are searchable but not filterable
        const isFreeText = !v.suggestions || v.suggestions.length === 0
        const filterable = !isFreeText
        const searchable = true

        try {
          await prisma.categoryAttribute.upsert({
            where: {
              categoryKey_subcategoryKey_key: {
                categoryKey,
                subcategoryKey,
                key: v.key,
              },
            },
            create: {
              categoryKey,
              subcategoryKey,
              key: v.key,
              label: v.label,
              type,
              options: v.suggestions && v.suggestions.length > 0 ? v.suggestions : null,
              required: false,
              filterable,
              searchable,
              sortOrder: i,
            },
            update: {
              label: v.label,
              type,
              options: v.suggestions && v.suggestions.length > 0 ? v.suggestions : null,
              filterable,
              searchable,
              sortOrder: i,
            },
          })
          count++
          totalSeeded++
        } catch (err) {
          console.error(`  [ERROR] Error seeding ${categoryKey}/${subcategoryKey}/${v.key}:`, err.message)
        }
      }

      console.log(`  [OK] ${categoryKey}/${subcategoryKey} - ${count} attributes`)
    }
  }

  console.log(`\n[DONE] Done! Seeded ${totalSeeded} attributes across ${totalSubcategories} subcategories.`)
}

main()
  .catch((e) => {
    console.error('[ERROR] Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
