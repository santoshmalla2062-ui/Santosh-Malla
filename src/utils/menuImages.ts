import { MenuItem } from '../types';

/**
 * High-quality food & beverage photography mapping for POS cards.
 * If the item has a custom `imageUrl` from the database/admin, it is prioritized.
 * Otherwise, a photo is matched based on item name and category.
 */
export function getMenuItemImageUrl(item: MenuItem): string {
  if (item.imageUrl && item.imageUrl.trim().length > 5) {
    return item.imageUrl;
  }

  const name = (item.name || '').toLowerCase();
  const nepali = (item.nepaliName || '').toLowerCase();
  const cat = item.category;

  // Specific dish / drink matchers
  if (name.includes('espresso') || nepali.includes('एस्प्रेसो')) {
    return 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('americano') || nepali.includes('अमेरिकानो')) {
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('cappuccino') || nepali.includes('क्यापुचिनो')) {
    return 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('latte') || nepali.includes('लात्ते')) {
    return 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('mocha') || name.includes('chocolate') || nepali.includes('मोका')) {
    return 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('chai') || name.includes('tea') || nepali.includes('चिया')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('lemonade') || name.includes('mojito') || name.includes('mint') || nepali.includes('लेमोनेड')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('pizza') || nepali.includes('पिजा') || name.includes('margherita')) {
    return 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('croissant') || nepali.includes('क्रोसाँ') || name.includes('pastry')) {
    return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('roll') || name.includes('kathi') || nepali.includes('रोल')) {
    return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('khana') || name.includes('thakali') || name.includes('thali') || nepali.includes('खाना') || nepali.includes('थाकाली')) {
    return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('choila') || name.includes('chicken') || nepali.includes('छोइला') || nepali.includes('चिकेन')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('momo') || name.includes('dumpling') || nepali.includes('मम')) {
    return 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('burger') || nepali.includes('बर्गर')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('cocktail') || name.includes('sunrise') || name.includes('beer') || nepali.includes('ककटेल')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('cake') || name.includes('cheesecake') || nepali.includes('केक')) {
    return 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=400&q=80';
  }

  // Category based default photography
  switch (cat) {
    case 'coffee':
    case 'cafe_beverages':
      return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80';
    case 'tea':
      return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80';
    case 'cold_drinks':
    case 'mocktails':
    case 'bar_spirits':
      return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80';
    case 'bakery':
    case 'bakery_snacks':
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80';
    case 'nepali_food':
    case 'dining_food':
      return 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=400&q=80';
    case 'fast_food':
    case 'snacks':
      return 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=400&q=80';
    case 'dessert':
    case 'desserts':
      return 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=400&q=80';
    default:
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
  }
}

export interface PresetFoodPhoto {
  id: string;
  label: string;
  nepaliLabel: string;
  category: string;
  url: string;
}

export const PRESET_FOOD_PHOTOS: PresetFoodPhoto[] = [
  { id: 'momo', label: 'Mo:Mo / Dumplings', nepaliLabel: 'मोमो', category: 'nepali_food', url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=600&q=80' },
  { id: 'thali', label: 'Nepali Thakali Thali', nepaliLabel: 'थाकाली खाना', category: 'nepali_food', url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80' },
  { id: 'choila', label: 'Chicken Chhoila / Sekuwa', nepaliLabel: 'छोइला / सेकुवा', category: 'nepali_food', url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80' },
  { id: 'chowmein', label: 'Fried Noodles / Chowmein', nepaliLabel: 'चाउमिन', category: 'fast_food', url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80' },
  { id: 'pizza', label: 'Woodfired Pizza', nepaliLabel: 'पिज्जा', category: 'fast_food', url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80' },
  { id: 'burger', label: 'Crispy Gourmet Burger', nepaliLabel: 'बर्गर', category: 'fast_food', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
  { id: 'fries', label: 'French Fries / Finger Food', nepaliLabel: 'फ्रेन्च फ्राइज', category: 'snacks', url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80' },
  { id: 'rolls', label: 'Kathi Roll / Frankie', nepaliLabel: 'रोल', category: 'snacks', url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80' },
  { id: 'biryani', label: 'Dum Biryani', nepaliLabel: 'बिरयानी', category: 'dining_food', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80' },
  { id: 'curry', label: 'Rich Curry & Gravy', nepaliLabel: 'करी / ग्रेभी', category: 'dining_food', url: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80' },
  { id: 'espresso', label: 'Arabica Espresso', nepaliLabel: 'एस्प्रेसो', category: 'coffee', url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80' },
  { id: 'cappuccino', label: 'Cappuccino / Latte', nepaliLabel: 'क्यापुचिनो', category: 'coffee', url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80' },
  { id: 'americano', label: 'Hot Caffe Americano', nepaliLabel: 'अमेरिकानो', category: 'coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' },
  { id: 'iced_coffee', label: 'Iced Latte / Cold Brew', nepaliLabel: 'आइस कफी', category: 'coffee', url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80' },
  { id: 'tea', label: 'Himalayan Masala Tea', nepaliLabel: 'मसला चिया', category: 'tea', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
  { id: 'lemonade', label: 'Fresh Lemonade / Mint Mojito', nepaliLabel: 'मोहितो / लेमोनेड', category: 'mocktails', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80' },
  { id: 'cocktail', label: 'Sunset Cocktail', nepaliLabel: 'ककटेल', category: 'bar_spirits', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80' },
  { id: 'croissant', label: 'Butter Croissant / Bakery', nepaliLabel: 'क्रोसाँ', category: 'bakery', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cake', label: 'Chocolate Cheesecake / Cake', nepaliLabel: 'केक', category: 'dessert', url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80' },
  { id: 'icecream', label: 'Ice Cream Sundae', nepaliLabel: 'आइसक्रिम', category: 'dessert', url: 'https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=600&q=80' }
];
