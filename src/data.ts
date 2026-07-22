import { Product } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Malabar Organic Coconut',
    category: 'Veggies & Fruits',
    price: 45,
    unit: '1 pc',
    description: 'Traditionally harvested husked coconuts from the organic farms of Alappuzha. Loaded with rich sweet water and creamy pulp.',
    image: 'https://images.unsplash.com/photo-1525203135335-74d272fc8d9c?auto=format&fit=crop&q=80&w=400',
    stock: 24,
    rating: 4.9,
    popular: true
  },
  {
    id: 'prod-2',
    name: 'Nendran Banana Bundle',
    category: 'Veggies & Fruits',
    price: 75,
    unit: '1 kg (approx 6-8 pcs)',
    description: 'Heritage Kerala Nendran bananas, highly nutritious, rich gold skins, perfect for steaming, baking, or enjoying ripe.',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=400',
    stock: 32,
    rating: 4.8,
    popular: true
  },
  {
    id: 'prod-3',
    name: 'Cold-Pressed Virgin Coconut Oil',
    category: 'Oils & Honey',
    price: 360,
    unit: '500 ml',
    description: '100% natural wooden cold-pressed (Chekku) oil from organic sun-dried copra. Zero chemicals, premium aroma.',
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&q=80&w=400',
    stock: 15,
    rating: 5.0,
    popular: true
  },
  {
    id: 'prod-4',
    name: 'Organic Wayanad Black Pepper',
    category: 'Spices & Spreads',
    price: 190,
    unit: '200g',
    description: 'Premium whole black pepper berries harvested and sun-dried in the humid valleys of Wayanad. Intensely pungent flavor profile.',
    image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&q=80&w=400',
    stock: 40,
    rating: 4.7,
    popular: false
  },
  {
    id: 'prod-5',
    name: 'Hills-grown True Green Cardamom',
    category: 'Spices & Spreads',
    price: 240,
    unit: '100g',
    description: 'Aromatic green cardamom pods harvested carefully at peak ripeness. Intense floral fragrance, perfect for Keralite payasams.',
    image: 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&q=80&w=400',
    stock: 18,
    rating: 4.9,
    popular: true
  },
  {
    id: 'prod-6',
    name: 'Organic Matta Red Rice',
    category: 'Kerala Staples',
    price: 85,
    unit: '1 kg',
    description: 'Traditional parboiled red rice from Palakkad fields containing essential nutrients retained inside the reddish-brown husk.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400',
    stock: 50,
    rating: 4.6,
    popular: false
  },
  {
    id: 'prod-7',
    name: 'Ripe Honey Mangoes (Muvandan)',
    category: 'Veggies & Fruits',
    price: 140,
    unit: '1 kg',
    description: 'Sweet, fibrous, native mangoes grown organically, carrying that authentic Kerala backyard summer flavor.',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400',
    stock: 12,
    rating: 4.8,
    popular: true
  },
  {
    id: 'prod-8',
    name: 'Wayanad Raw Wild Honey',
    category: 'Oils & Honey',
    price: 290,
    unit: '250g',
    description: 'Sourced from natural forest beehives of Wayanad. Unfiltered, unpasteurized, retaining trace pollens and organic nutrients.',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=400',
    stock: 10,
    rating: 4.9,
    popular: false
  },
  {
    id: 'prod-9',
    name: 'Organic Kasturi Turmeric Powder',
    category: 'Spices & Spreads',
    price: 110,
    unit: '150g',
    description: 'Premium cosmetic and culinary fragrant wild turmeric powder. Purely organic and free of artificial yellow color additives.',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=400',
    stock: 25,
    rating: 4.7,
    popular: false
  }
];

export const CATEGORIES = [
  { name: 'All', icon: 'Leaf' },
  { name: 'Veggies & Fruits', icon: 'Apple' },
  { name: 'Spices & Spreads', icon: 'Flame' },
  { name: 'Oils & Honey', icon: 'Droplets' },
  { name: 'Kerala Staples', icon: 'Wheat' }
];

export const INSTANT_OFFERS = [
  {
    id: 'off-1',
    title: 'Monsoon Farm Blessings',
    discount: 'Get 20% Off',
    code: 'FRESHRAIN',
    description: 'On orders of ₹249 and above',
    badge: 'Limited Offer'
  },
  {
    id: 'off-2',
    title: 'First Harvest Gift',
    discount: 'Get 10% Off',
    code: 'FIRSTDROP',
    description: '10% off your very first order',
    badge: 'New User'
  }
];
