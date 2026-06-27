// lib/variants.ts
// Central source of truth for BataMart category → subcategory → variant system
// Used across: sell page, product page, search, cart, checkout, orders

export interface VariantField {
  key: string          // internal key e.g. "storage"
  label: string        // display label e.g. "Storage"
  suggestions: string[] // quick-add chips
}

export interface SubcategoryConfig {
  label: string
  variants: VariantField[]
}

export interface CategoryConfig {
  label: string
  icon: string
  subcategories: Record<string, SubcategoryConfig>
}

// ────────────────────────────────────────────────────────────────────────────
// MASTER CATEGORY TREE
// ────────────────────────────────────────────────────────────────────────────
export const CATEGORY_TREE: Record<string, CategoryConfig> = {
  electronics: {
    label: 'Electronics',
    icon: '📱',
    subcategories: {
      phones_tablets: {
        label: 'Phones / Tablets',
        variants: [
          { key: 'brand',          label: 'Brand',          suggestions: ['Apple','Samsung','Tecno','Infinix','Xiaomi','OnePlus','Google'] },
          { key: 'model',          label: 'Model',          suggestions: ['iPhone 13','iPhone 14','iPhone 15','Galaxy S23','Galaxy A54'] },
          { key: 'storage',        label: 'Storage',        suggestions: ['64GB','128GB','256GB','512GB','1TB'] },
          { key: 'ram',            label: 'RAM',            suggestions: ['4GB','6GB','8GB','12GB','16GB'] },
          { key: 'color',          label: 'Color',          suggestions: ['Black','White','Gold','Blue','Red','Purple','Green'] },
          { key: 'condition',      label: 'Condition',      suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
          { key: 'warranty',       label: 'Warranty',       suggestions: ['No Warranty','1 Month','3 Months','6 Months','1 Year'] },
          { key: 'battery_health', label: 'Battery Health', suggestions: ['100%','95%','90%','85%','80%','Below 80%'] },
        ],
      },
      laptops: {
        label: 'Laptops',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Apple','Dell','HP','Lenovo','Asus','Acer','Microsoft','LG'] },
          { key: 'model',     label: 'Model',     suggestions: ['MacBook Pro','MacBook Air','Dell XPS','ThinkPad','HP Spectre'] },
          { key: 'storage',   label: 'Storage',   suggestions: ['256GB SSD','512GB SSD','1TB SSD','2TB SSD','256GB HDD','1TB HDD'] },
          { key: 'ram',       label: 'RAM',       suggestions: ['4GB','8GB','16GB','32GB','64GB'] },
          { key: 'processor', label: 'Processor', suggestions: ['Intel i3','Intel i5','Intel i7','Intel i9','M1','M2','M3','Ryzen 5','Ryzen 7'] },
          { key: 'screen',    label: 'Screen Size',suggestions: ['11 inch','13 inch','14 inch','15 inch','16 inch','17 inch'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
          { key: 'color',     label: 'Color',     suggestions: ['Silver','Space Gray','Black','White','Gold','Blue'] },
        ],
      },
      tvs: {
        label: 'TVs',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Samsung','LG','Sony','Hisense','TCL','Skyworth'] },
          { key: 'screen',    label: 'Screen Size',suggestions: ['32 inch','43 inch','50 inch','55 inch','65 inch','75 inch'] },
          { key: 'type',      label: 'Type',      suggestions: ['Smart TV','4K UHD','OLED','QLED','LED','Android TV'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      audio: {
        label: 'Audio',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Sony','JBL','Bose','Apple','Samsung','Anker','Oraimo'] },
          { key: 'type',      label: 'Type',      suggestions: ['Earbuds','Headphones','Speaker','Earphone','Soundbar'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Blue','Red','Pink','Gray'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'connectivity', label: 'Connectivity', suggestions: ['Bluetooth','Wired','True Wireless','USB-C'] },
        ],
      },
      cameras: {
        label: 'Cameras',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Canon','Nikon','Sony','Fujifilm','GoPro','DJI'] },
          { key: 'type',      label: 'Type',      suggestions: ['DSLR','Mirrorless','Action Camera','Drone Camera','Film Camera'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      accessories_electronics: {
        label: 'Accessories',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Charger','Cable','Case','Screen Protector','Power Bank','Adapter','Stand'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Apple','Samsung','Anker','Baseus','Ugreen','Generic'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Clear','Gold','Silver'] },
        ],
      },
    },
  },

  fashion: {
    label: 'Fashion',
    icon: '👔',
    subcategories: {
      mens_wear: {
        label: "Men's Wear",
        variants: [
          { key: 'size',      label: 'Size',      suggestions: ['XS','S','M','L','XL','XXL','XXXL'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Navy','Gray','Brown','Green','Red'] },
          { key: 'type',      label: 'Type',      suggestions: ['T-Shirt','Shirt','Trousers','Jeans','Shorts','Suit','Jacket','Agbada','Senator'] },
          { key: 'material',  label: 'Material',  suggestions: ['Cotton','Polyester','Denim','Linen','Silk','Wool'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'fit',       label: 'Fit',       suggestions: ['Slim Fit','Regular Fit','Oversized','Baggy'] },
        ],
      },
      womens_wear: {
        label: "Women's Wear",
        variants: [
          { key: 'size',      label: 'Size',      suggestions: ['XS','S','M','L','XL','XXL','Free Size'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Pink','Red','Blue','Yellow','Floral','Multi'] },
          { key: 'type',      label: 'Type',      suggestions: ['Dress','Blouse','Skirt','Trousers','Jumpsuit','Iro & Buba','Gown','Crop Top'] },
          { key: 'material',  label: 'Material',  suggestions: ['Cotton','Polyester','Silk','Lace','Ankara','Chiffon','Denim'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      shoes: {
        label: 'Shoes',
        variants: [
          { key: 'size',      label: 'Size',      suggestions: ['36','37','38','39','40','41','42','43','44','45','46'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Brown','Tan','Gray','Multi'] },
          { key: 'type',      label: 'Type',      suggestions: ['Sneakers','Sandals','Heels','Boots','Loafers','Slippers','Oxford'] },
          { key: 'gender',    label: 'Gender',    suggestions: ['Male','Female','Unisex'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Nike','Adidas','Converse','Puma','Vans','Zara','H&M'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      bags: {
        label: 'Bags',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Handbag','Backpack','Laptop Bag','Tote','Clutch','Waist Bag','Travel Bag'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','Brown','Tan','White','Red','Navy','Multi'] },
          { key: 'material',  label: 'Material',  suggestions: ['Leather','Synthetic','Canvas','Fabric'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Gucci','Louis Vuitton','Zara','H&M','Local Brand','No Brand'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      watches: {
        label: 'Watches',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Apple','Samsung','Casio','Rolex','Seiko','Hublot','Guess','Generic'] },
          { key: 'type',      label: 'Type',      suggestions: ['Smartwatch','Analog','Digital','Luxury','Sport'] },
          { key: 'gender',    label: 'Gender',    suggestions: ['Male','Female','Unisex'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','Silver','Gold','Rose Gold','Blue','Brown'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      accessories_fashion: {
        label: 'Accessories',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Belt','Cap','Sunglasses','Jewelry','Scarf','Tie','Wallet','Perfume'] },
          { key: 'gender',    label: 'Gender',    suggestions: ['Male','Female','Unisex'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','Brown','Gold','Silver','Multi','Clear'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
    },
  },

  home_kitchen: {
    label: 'Home & Kitchen',
    icon: '🏠',
    subcategories: {
      furniture: {
        label: 'Furniture',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Bed Frame','Mattress','Chair','Table','Wardrobe','Sofa','Shelf','Desk'] },
          { key: 'material',  label: 'Material',  suggestions: ['Wood','Metal','Plastic','Fabric','Foam','Glass'] },
          { key: 'color',     label: 'Color',     suggestions: ['Brown','Black','White','Gray','Natural Wood'] },
          { key: 'size',      label: 'Size',      suggestions: ['Single','Double','Queen','King','Small','Medium','Large'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Good Condition'] },
        ],
      },
      kitchen_appliances: {
        label: 'Kitchen Appliances',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Blender','Microwave','Gas Cooker','Electric Cooker','Fridge','Freezer','Toaster','Kettle','Iron'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['LG','Samsung','Haier','Nexus','Thermocool','Binatone','Philips'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Silver','Red'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Good Working Condition'] },
        ],
      },
      bedding: {
        label: 'Bedding',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Pillow','Duvet','Bed Sheet','Mattress Topper','Blanket'] },
          { key: 'size',      label: 'Size',      suggestions: ['Single','Double','Queen','King','Free Size'] },
          { key: 'color',     label: 'Color',     suggestions: ['White','Gray','Blue','Pink','Multi','Striped'] },
          { key: 'material',  label: 'Material',  suggestions: ['Cotton','Polyester','Microfiber','Foam','Wool'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      lighting: {
        label: 'Lighting',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['LED Bulb','Floor Lamp','Table Lamp','String Lights','Ceiling Light','Spotlight'] },
          { key: 'color',     label: 'Color',     suggestions: ['White','Warm White','RGB','Yellow','Daylight'] },
          { key: 'wattage',   label: 'Wattage',   suggestions: ['5W','9W','12W','18W','24W'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      decor: {
        label: 'Decor',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Wall Art','Plant Pot','Mirror','Vase','Rug','Curtain','Clock','Photo Frame'] },
          { key: 'color',     label: 'Color',     suggestions: ['Neutral','Black','White','Gold','Silver','Multi'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
    },
  },

  beauty: {
    label: 'Beauty & Personal Care',
    icon: '💄',
    subcategories: {
      skincare: {
        label: 'Skincare',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Moisturizer','Serum','Sunscreen','Face Wash','Toner','Mask','Eye Cream','Body Lotion'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Neutrogena','CeraVe','Olay','Nivea','Garnier','The Ordinary','Local Brand'] },
          { key: 'skin_type', label: 'Skin Type', suggestions: ['Oily','Dry','Combination','Sensitive','All Skin Types'] },
          { key: 'gender',    label: 'For',       suggestions: ['Men','Women','Unisex'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Sealed','Authentic'] },
        ],
      },
      haircare: {
        label: 'Haircare',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Shampoo','Conditioner','Hair Oil','Hair Cream','Relaxer','Wig','Weave','Braids'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Cantu','Shea Moisture','ORS','Dark & Lovely','Revlon','Local Brand'] },
          { key: 'hair_type', label: 'Hair Type', suggestions: ['Natural Hair','Relaxed','All Hair Types'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Sealed','UK Used'] },
        ],
      },
      makeup: {
        label: 'Makeup',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Foundation','Lipstick','Eyeshadow','Mascara','Concealer','Blush','Setting Spray','Brush Set'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['MAC','Maybelline','NYX','Fenty Beauty','L.A. Girl','Ruby Woo','Zaron'] },
          { key: 'shade',     label: 'Shade',     suggestions: ['Light','Medium','Dark','Universal','Check Description'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Sealed','Authentic'] },
        ],
      },
      fragrances: {
        label: 'Fragrances',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Dior','Chanel','Versace','Hugo Boss','Gucci','Tom Ford','Armani','Local Blend'] },
          { key: 'type',      label: 'Type',      suggestions: ['Perfume','EDP','EDT','Body Spray','Attar/Oil'] },
          { key: 'gender',    label: 'For',       suggestions: ['Men','Women','Unisex'] },
          { key: 'size',      label: 'Size',      suggestions: ['30ml','50ml','100ml','150ml','200ml'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Sealed','Authentic','Decant'] },
        ],
      },
      grooming: {
        label: 'Grooming',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Clippers','Razor','Shaving Cream','Deodorant','Beard Oil','Cologne','Nail Care'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Andis','Wahl','Gillette','Nivea Men','Dove Men','Generic'] },
          { key: 'gender',    label: 'For',       suggestions: ['Men','Women','Unisex'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
    },
  },

  groceries: {
    label: 'Groceries / Food / Fast Food',
    icon: '🍔',
    subcategories: {
      beverages: {
        label: 'Beverages',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Water','Juice','Soft Drink','Energy Drink','Milk','Tea','Coffee','Smoothie'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Coca-Cola','Pepsi','Hollandia','Chivita','Milo','Peak','Nestlé'] },
          { key: 'size',      label: 'Size / Pack',suggestions: ['Single','Pack of 6','Pack of 12','Carton','Small','Medium','Large','1 Litre','2 Litres'] },
          { key: 'temperature',label: 'Temperature',suggestions: ['Cold','Room Temp'] },
        ],
      },
      snacks: {
        label: 'Snacks',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Chips','Puff Puff','Chin Chin','Cookies','Cake','Donuts','Meat Pie','Biscuit'] },
          { key: 'size',      label: 'Pack Size', suggestions: ['Small','Medium','Large','Per Piece','Box'] },
          { key: 'taste',     label: 'Taste',     suggestions: ['Sweet','Spicy','Savory','Salty','Plain'] },
          { key: 'homemade',  label: 'Made',      suggestions: ['Homemade','Store-bought','Imported','Local Brand'] },
        ],
      },
      fresh_food: {
        label: 'Fresh Food',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Jollof Rice','Fried Rice','Egusi Soup','Ogbono Soup','Pepper Soup','Shawarma','Pizza','Noodles','Beans','Salad','Sandwich'] },
          { key: 'size',      label: 'Portion',   suggestions: ['Small Plate','Medium Plate','Large Plate','Family Size','Per Pack'] },
          { key: 'protein',   label: 'Protein',   suggestions: ['Chicken','Beef','Fish','Goat','Vegetarian','Egg'] },
          { key: 'spice',     label: 'Spice',     suggestions: ['Mild','Medium','Spicy','Extra Spicy'] },
        ],
      },
      packaged_food: {
        label: 'Packaged Food',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Rice','Pasta','Flour','Sugar','Cooking Oil','Tomato','Seasoning','Spice'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Dangote','Golden Penny','Mama\'s Pride','Knorr','Maggi','Indomie','De Rica'] },
          { key: 'size',      label: 'Pack Size', suggestions: ['Small','500g','1kg','2kg','5kg','50kg'] },
        ],
      },
    },
  },

  computing: {
    label: 'Computing',
    icon: '💻',
    subcategories: {
      desktops: {
        label: 'Desktops',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Dell','HP','Lenovo','Apple','Asus','Custom Build'] },
          { key: 'storage',   label: 'Storage',   suggestions: ['256GB SSD','512GB SSD','1TB SSD','1TB HDD','2TB HDD'] },
          { key: 'ram',       label: 'RAM',       suggestions: ['4GB','8GB','16GB','32GB'] },
          { key: 'processor', label: 'Processor', suggestions: ['Intel i3','Intel i5','Intel i7','Intel i9','AMD Ryzen 5','AMD Ryzen 7'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Refurbished'] },
        ],
      },
      accessories_computing: {
        label: 'Accessories',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Keyboard','Mouse','Monitor','External Drive','USB Hub','Webcam','Cooling Pad','Bag'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Logitech','Dell','HP','Microsoft','Anker','Generic'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Silver','Gray'] },
        ],
      },
      networking: {
        label: 'Networking',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Router','Modem','Switch','Ethernet Cable','WiFi Extender','Data Card'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['TP-Link','Netgear','Cisco','Dlink','Huawei','GL.iNet'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
    },
  },

  gaming: {
    label: 'Gaming',
    icon: '🎮',
    subcategories: {
      consoles: {
        label: 'Consoles',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['PlayStation','Xbox','Nintendo'] },
          { key: 'model',     label: 'Model',     suggestions: ['PS5','PS4','PS4 Pro','Xbox Series X','Xbox Series S','Xbox One','Nintendo Switch','Switch Lite'] },
          { key: 'storage',   label: 'Storage',   suggestions: ['Default','256GB','512GB','1TB'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Red','Blue','Special Edition'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'bundle',    label: 'Bundle',    suggestions: ['Console Only','With Controller','With Games','Full Bundle'] },
        ],
      },
      games: {
        label: 'Games',
        variants: [
          { key: 'platform',  label: 'Platform',  suggestions: ['PS5','PS4','Xbox Series','Xbox One','Nintendo Switch','PC'] },
          { key: 'genre',     label: 'Genre',     suggestions: ['Action','Sports','RPG','Racing','FPS','Adventure','Fighting'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used','Digital Code'] },
        ],
      },
      accessories_gaming: {
        label: 'Accessories',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Controller','Headset','Gaming Chair','Capture Card','Memory Card','Charging Dock'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Sony','Microsoft','Razer','Logitech','HyperX','Generic'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Red','Blue','Multi'] },
        ],
      },
    },
  },

  automotive: {
    label: 'Automotive',
    icon: '🚗',
    subcategories: {
      cars: {
        label: 'Cars',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Toyota','Honda','Mercedes','BMW','Hyundai','Ford','Kia','Lexus','Benz'] },
          { key: 'model',     label: 'Model',     suggestions: ['Camry','Corolla','Civic','Accord','Highlander','Venza','Rav4'] },
          { key: 'year',      label: 'Year',      suggestions: ['2020','2019','2018','2017','2016','2015','2010 & below'] },
          { key: 'condition', label: 'Condition', suggestions: ['Foreign Used (Tokunbo)','Nigerian Used','Brand New'] },
          { key: 'fuel',      label: 'Fuel Type', suggestions: ['Petrol','Diesel','Hybrid','Electric'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','White','Silver','Gray','Red','Blue'] },
        ],
      },
      motorcycles: {
        label: 'Motorcycles',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Honda','Bajaj','Yamaha','Suzuki','TVS','Jincheng'] },
          { key: 'type',      label: 'Type',      suggestions: ['Okada (Commercial)','Sport','Commuter','Electric'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Nigerian Used','UK Used'] },
          { key: 'color',     label: 'Color',     suggestions: ['Black','Red','Blue','Silver','Yellow'] },
        ],
      },
      spare_parts: {
        label: 'Spare Parts',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Engine Parts','Body Parts','Electrical','Tyre','Battery','Brake Parts','Lights'] },
          { key: 'compatible',label: 'Compatible With', suggestions: ['Toyota','Honda','Mercedes','BMW','All Brands'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Tokunbo','Nigerian Used'] },
        ],
      },
    },
  },

  baby_products: {
    label: 'Baby Products',
    icon: '👶',
    subcategories: {
      baby_clothing: {
        label: 'Clothing',
        variants: [
          { key: 'size',      label: 'Size / Age',suggestions: ['0-3 months','3-6 months','6-12 months','1-2 years','2-3 years','3-5 years'] },
          { key: 'gender',    label: 'Gender',    suggestions: ['Boy','Girl','Unisex'] },
          { key: 'type',      label: 'Type',      suggestions: ['Romper','Onesie','Set','Dress','Sleepwear','Shoes','Hat'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Barely Used','Good Condition'] },
        ],
      },
      toys: {
        label: 'Toys',
        variants: [
          { key: 'age',       label: 'Age Range', suggestions: ['0-6 months','6-12 months','1-3 years','3-5 years','5-8 years','8+ years'] },
          { key: 'type',      label: 'Type',      suggestions: ['Educational','Stuffed Animal','Building Blocks','Outdoor','Electronic','Puzzle','Doll','Car'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      feeding: {
        label: 'Feeding',
        variants: [
          { key: 'type',      label: 'Type',      suggestions: ['Baby Formula','Baby Food','Feeding Bottle','Nipple','Sterilizer','High Chair','Bib'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Similac','Nan','SMA','Cerelac','Nutrend','Avent','MAM','Generic'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','Sealed'] },
        ],
      },
      diapers: {
        label: 'Diapers',
        variants: [
          { key: 'brand',     label: 'Brand',     suggestions: ['Pampers','Huggies','Molfix','Dryfit','Local Brand'] },
          { key: 'size',      label: 'Size',      suggestions: ['Newborn','Size 1','Size 2','Size 3','Size 4','Size 5','Size 6'] },
          { key: 'pack',      label: 'Pack Size', suggestions: ['Trial Pack','Small Pack','Medium Pack','Large Pack','Jumbo Pack','Carton'] },
          { key: 'type',      label: 'Type',      suggestions: ['Regular','Pull-Up','Sensitive Skin','Night'] },
        ],
      },
    },
  },

  pets: {
    label: 'Pets',
    icon: '🐾',
    subcategories: {
      pet_food: {
        label: 'Pet Food',
        variants: [
          { key: 'animal',    label: 'For',       suggestions: ['Dog','Cat','Fish','Bird','Rabbit','Hamster'] },
          { key: 'brand',     label: 'Brand',     suggestions: ['Royal Canin','Pedigree','Whiskas','Purina','Hills','Local Brand'] },
          { key: 'size',      label: 'Pack Size', suggestions: ['Small','1kg','2kg','5kg','10kg','20kg'] },
          { key: 'type',      label: 'Type',      suggestions: ['Dry Food','Wet Food','Treats','Supplement'] },
        ],
      },
      pet_accessories: {
        label: 'Accessories',
        variants: [
          { key: 'animal',    label: 'For',       suggestions: ['Dog','Cat','Fish','Bird','Rabbit','General'] },
          { key: 'type',      label: 'Type',      suggestions: ['Collar','Leash','Cage','Bed','Toy','Grooming','Feeding Bowl','Carrier'] },
          { key: 'condition', label: 'Condition', suggestions: ['Brand New','UK Used','Nigerian Used'] },
        ],
      },
      live_animals: {
        label: 'Live Animals',
        variants: [
          { key: 'type',      label: 'Animal',    suggestions: ['Dog','Cat','Fish','Bird','Rabbit','Hamster','Tortoise','Chicken'] },
          { key: 'breed',     label: 'Breed',     suggestions: ['German Shepherd','Poodle','Persian','Siamese','Goldfish','Parrot','Local Breed'] },
          { key: 'age',       label: 'Age',       suggestions: ['Baby','Young','Adult'] },
          { key: 'gender',    label: 'Gender',    suggestions: ['Male','Female','Unknown'] },
        ],
      },
    },
  },
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

export function getCategoryList() {
  return Object.entries(CATEGORY_TREE).map(([key, cat]) => ({
    key,
    label: cat.label,
    icon: cat.icon,
  }))
}

export function getCategoryDisplayInfo(categoryKey?: string | null, subcategoryKey?: string | null, fallbackCategory?: string | null, fallbackSubcategory?: string | null) {
  const categoryLabel = categoryKey && CATEGORY_TREE[categoryKey]?.label
    ? CATEGORY_TREE[categoryKey].label
    : fallbackCategory || ''

  const subcategoryLabel = categoryKey && subcategoryKey && CATEGORY_TREE[categoryKey]?.subcategories?.[subcategoryKey]?.label
    ? CATEGORY_TREE[categoryKey].subcategories[subcategoryKey].label
    : fallbackSubcategory || ''

  return {
    category: categoryLabel || fallbackCategory || '',
    subcategory: subcategoryLabel || fallbackSubcategory || null,
  }
}

export function getSubcategoryList(categoryKey: string) {
  const cat = CATEGORY_TREE[categoryKey]
  if (!cat) return []
  return Object.entries(cat.subcategories).map(([key, sub]) => ({
    key,
    label: sub.label,
  }))
}

export function getVariantFields(categoryKey: string, subcategoryKey: string): VariantField[] {
  return CATEGORY_TREE[categoryKey]?.subcategories[subcategoryKey]?.variants ?? []
}

// ── Encode variant map → JSON string stored in description ──────────────────
// Format: "VARIANTS_V2::<base64-json>"
// Falls back gracefully — products without this prefix are treated as legacy.
export function encodeProductData(variants: Record<string, string[]>, tags: string[]): string {
  const payload = { variants, tags }
  return 'VARIANTS_V2::' + btoa(JSON.stringify(payload))
}

export function decodeProductData(description: string): { variants: Record<string, string[]>; tags: string[] } {
  if (description?.startsWith('VARIANTS_V2::')) {
    try {
      return JSON.parse(atob(description.replace('VARIANTS_V2::', '')))
    } catch {}
  }
  // Legacy: pipe-separated tags
  const tags = description?.includes(' | ')
    ? description.split(' | ').map(t => t.trim()).filter(Boolean)
    : (description ? [description] : [])
  return { variants: {}, tags }
}

// Server-safe version (no btoa/atob)
export function encodeProductDataServer(variants: Record<string, string[]>, tags: string[]): string {
  const payload = JSON.stringify({ variants, tags })
  return 'VARIANTS_V2::' + Buffer.from(payload).toString('base64')
}

export function decodeProductDataServer(description: string): { variants: Record<string, string[]>; tags: string[] } {
  if (description?.startsWith('VARIANTS_V2::')) {
    try {
      return JSON.parse(Buffer.from(description.replace('VARIANTS_V2::', ''), 'base64').toString('utf-8'))
    } catch {}
  }
  const tags = description?.includes(' | ')
    ? description.split(' | ').map((t: string) => t.trim()).filter(Boolean)
    : (description ? [description] : [])
  return { variants: {}, tags }
}

// ── Format selected variant combo → human-readable string ──────────────────
export function formatVariantSelection(selected: Record<string, string>): string {
  return Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v}`)
    .join(' · ')
}

// ── Build search text from product for full-text matching ──────────────────
export function buildProductSearchText(product: {
  name: string
  category: string
  subcategory?: string
  description: string
}): string {
  const { variants, tags } = decodeProductData(product.description)
  const variantValues = Object.values(variants).flat()
  return [
    product.name,
    product.category,
    product.subcategory ?? '',
    ...tags,
    ...variantValues,
  ].join(' ').toLowerCase()
}