import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal, RevealText, DrawnRule, MarqueeStrip } from '../lib/motion';
import { menuImage } from '../lib/foodImages';
import axios from 'axios';
import { toast } from 'react-toastify';

const HERO_IMAGE = '/images/dining.jpg';

// Collapse the many back-office categories into a tidy, fixed set of menu
// groups (matched by keyword, so it's robust to exact naming). Anything that
// matches nothing lands in "More".
const MENU_GROUPS = [
  { label: 'Starters', keys: ['appetiz', 'starter', 'chaat', 'snack', 'soup', 'momo', 'roll', 'pakora', 'tikka', 'kebab', 'salad', 'raita', 'papad'] },
  { label: 'South Indian', keys: ['dosa', 'idli', 'vada', 'uttapam', 'south'] },
  { label: 'Chinese', keys: ['chinese', 'manchur', 'schezwan', 'hakka', 'noodle', 'chow'] },
  { label: 'Main Courses', keys: ['main', 'chicken', 'mutton', 'fish', 'prawn', 'egg', 'paneer', 'mushroom', 'veg', 'sabji', 'sabzi', 'tandoor', 'curry', 'masala', 'gravy', 'kofta', 'dal', 'daal', 'thali', 'combo'] },
  { label: 'Breads & Rice', keys: ['bread', 'roti', 'naan', 'paratha', 'kulcha', 'rice', 'biryani', 'pulao', 'pasta'] },
  { label: 'Breakfast', keys: ['breakfast'] },
  { label: 'Desserts', keys: ['dessert', 'sweet', 'ice cream', 'kulfi', 'halwa'] },
  { label: 'Beverages', keys: ['drink', 'beverage', 'tea', 'coffee', 'juice', 'lassi', 'shake', 'mocktail'] },
];
const groupForCategory = (name) => {
  const n = String(name || '').toLowerCase();
  const g = MENU_GROUPS.find((grp) => grp.keys.some((k) => n.includes(k)));
  return g ? g.label : 'More';
};

const Restaurant = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  // Auto-fill the room number from ?room=<no> so QR codes placed in rooms
  // (or links shared with checked-in guests) skip the manual entry step.
  const [roomNumber, setRoomNumber] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || params.get('roomNumber') || '').trim();
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/website/restaurant/menu');
        setMenuItems(data);
      } catch (err) {
        console.error('Error fetching menu:', err);
        toast.error('Failed to load menu items');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addToCart = (item) => {
    const existing = cart.find((c) => c._id === item._id);
    if (existing) {
      setCart(cart.map((c) => (c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.name} added`);
  };

  const removeFromCart = (id) => setCart(cart.filter((i) => i._id !== id));
  const updateQuantity = (id, q) =>
    q <= 0 ? removeFromCart(id) : setCart(cart.map((i) => (i._id === id ? { ...i, quantity: q } : i)));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return toast.error('Your basket is empty');
    setPlacingOrder(true);
    try {
      const trimmedRoom = roomNumber.trim();
      const orderData = {
        orderType: 'website',
        items: cart.map((i) => ({ itemId: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        totalAmount: subtotal,
        status: 'Pending',
        specialInstructions,
        customerInfo: { name: 'Website Customer', phone: 'N/A', email: 'website@hotel.com' },
        ...(trimmedRoom ? { roomNumber: trimmedRoom } : {}),
      };
      const { data } = await axios.post('/api/website/restaurant-order', orderData);
      if (data.success) {
        toast.success(data.message ? `${data.message} · No. ${data.orderNumber}` : `Order placed · No. ${data.orderNumber}`);
        setCart([]);
        setSpecialInstructions('');
        setRoomNumber('');
        setCartOpen(false);
      } else {
        toast.error('Order could not be placed');
      }
    } catch (err) {
      console.error('Error placing order:', err);
      const msg = err.response?.data?.message || 'Order could not be placed. Please try again.';
      toast.error(msg);
    } finally {
      setPlacingOrder(false);
    }
  };

  const filteredItems = menuItems.filter(
    (i) => selectedCategory === 'all' || groupForCategory(i.category?.name) === selectedCategory,
  );

  // Only show pills for groups that actually have dishes.
  const presentGroups = MENU_GROUPS
    .map((g) => g.label)
    .filter((label) => menuItems.some((i) => groupForCategory(i.category?.name) === label));
  const hasMore = menuItems.some((i) => groupForCategory(i.category?.name) === 'More');

  return (
    <main className="bg-bone-100">
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[720px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center ken-burns"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/30 via-ink-900/15 to-ink-900/75" />
        {/* Top scrim keeps the transparent navbar readable over bright images. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none" />
        <div className="relative h-full edge flex flex-col justify-end pb-16 md:pb-24 pt-40 md:pt-48">
          <div className="max-w-3xl">
            <Reveal variant="fadeRight"><p className="eyebrow-on-dark mb-6">— The Restaurant</p></Reveal>
            <h1 className="font-serif font-light text-bone-100 text-display tracking-tight text-balance">
              <RevealText text="Cooked all day," as="span" className="block" />
              <RevealText text="from what the market brought." as="span" delay={0.4} className="block" />
            </h1>
            <Reveal variant="fadeUp" delay={0.9}>
              <p className="mt-8 max-w-md text-bone-100/85 font-light text-lg leading-relaxed">
                North Indian and Chinese, served in the dining room or taken up
                to your room. Open from breakfast until the last guest leaves.
              </p>
            </Reveal>
            <Reveal variant="fadeUp" delay={1.1}>
              <div className="mt-8"><DrawnRule width={64} color="#B08D57" /></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Marquee band */}
      <section className="bg-bone-200 border-y border-ink-100 overflow-hidden py-8 md:py-10">
        <MarqueeStrip
          speed={46}
          items={['North Indian', 'Chinese', 'Veg & Non-veg', 'Room service all day', 'Open for breakfast', 'Take-away']}
        />
      </section>

      {/* Menu */}
      <section className="section">
        <div className="edge">
          {/* Header — Themist-style badge + heading + category pills */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-20">
            <Reveal variant="fadeUp">
              <span className="inline-block rounded-full border border-ink-200 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-ink-500 font-medium">
                Meal Options
              </span>
              <h2 className="font-sans font-extrabold text-4xl md:text-6xl text-ink-900 tracking-tight mt-6 leading-[0.95]">
                Restaurant <span className="text-brass-400">Menu</span>
              </h2>
            </Reveal>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`rounded-full px-6 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  selectedCategory === 'all' ? 'bg-brass-400 text-bone-50' : 'border border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900'
                }`}
              >
                All
              </button>
              {presentGroups.map((label) => (
                <button
                  key={label}
                  onClick={() => setSelectedCategory(label)}
                  className={`rounded-full press-3d px-6 py-2.5 text-sm font-medium transition-colors duration-300 ${
                    selectedCategory === label ? 'bg-brass-400 text-bone-50' : 'border border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900'
                  }`}
                >
                  {label}
                </button>
              ))}
              {hasMore && (
                <button
                  onClick={() => setSelectedCategory('More')}
                  className={`rounded-full press-3d px-6 py-2.5 text-sm font-medium transition-colors duration-300 ${
                    selectedCategory === 'More' ? 'bg-brass-400 text-bone-50' : 'border border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900'
                  }`}
                >
                  More
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-32">
              <div className="w-12 h-12 border border-ink-200 border-t-ink-900 rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 md:gap-y-9 max-w-5xl mx-auto"
              >
                {filteredItems.map((item, i) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.6, delay: (i % 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="group"
                  >
                    <div className="flex items-baseline gap-3">
                      <h3 className="font-sans font-bold text-base md:text-lg text-ink-900 inline-flex items-center gap-2 shrink-0">
                        {item.isVeg !== undefined && (
                          <span
                            aria-label={item.isVeg ? 'Veg' : 'Non-veg'}
                            className={`block w-2.5 h-2.5 border ${item.isVeg ? 'border-emerald-600' : 'border-rose-600'} p-px`}
                          >
                            <span className={`block w-full h-full rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          </span>
                        )}
                        {item.name}
                        {item.popular && <span className="text-brass-500 text-sm" aria-label="Favourite">★</span>}
                      </h3>
                      <span aria-hidden className="flex-1 border-b border-dotted border-ink-300 -translate-y-1" />
                      <span className="font-sans font-bold text-base md:text-lg text-ink-900 shrink-0">₹{item.price}</span>
                      <button
                        onClick={() => addToCart(item)}
                        aria-label={`Add ${item.name} to order`}
                        className="shrink-0 w-7 h-7 rounded-full press-3d border border-ink-200 text-ink-500 flex items-center justify-center hover:bg-brass-400 hover:text-bone-50 hover:border-brass-400 hover:scale-110 transition-colors duration-300"
                      >
                        +
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="py-32 text-center">
              <p className="font-serif text-2xl text-ink-700 font-light">Nothing in this section today.</p>
              <button onClick={() => setSelectedCategory('all')} className="link-underline mt-6 text-ink-900">
                Show the whole menu
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Floating basket trigger */}
      <AnimatePresence>
        {itemCount > 0 && !cartOpen && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3, scale: 1.03 }}
            whileTap={{ y: 0, scale: 0.98 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-ink-900 text-bone-100 px-7 py-4 flex items-center gap-6 rounded-full shadow-[0_18px_40px_-12px_rgba(26,26,26,0.6)]"
          >
            <span className="text-xs uppercase tracking-widest font-medium">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <span className="block w-px h-4 bg-bone-100/30" />
            <span className="font-serif text-base">₹{total}</span>
            <span className="block w-px h-4 bg-bone-100/30" />
            <span className="text-xs uppercase tracking-widest font-medium">Review →</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-40"
              onClick={() => setCartOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-bone-100 z-50 overflow-y-auto rounded-l-3xl shadow-[-24px_0_60px_-20px_rgba(26,26,26,0.35)]"
            >
              <div className="p-8 md:p-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <p className="eyebrow">— Your basket</p>
                    <h3 className="font-serif font-light text-3xl text-ink-900 mt-2">{itemCount} {itemCount === 1 ? 'item' : 'items'}</h3>
                  </div>
                  <button onClick={() => setCartOpen(false)} className="text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900">Close</button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto -mr-4 pr-4">
                  {cart.map((item) => (
                    <div key={item._id} className="flex gap-4 pb-6 border-b border-ink-100">
                      <img src={menuImage(item)} alt={item.name} className="w-16 h-16 object-cover flex-shrink-0 rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-lg text-ink-900 leading-tight">{item.name}</p>
                        <p className="text-xs uppercase tracking-widest text-ink-400 mt-1">₹{item.price} each</p>
                        <div className="flex items-center gap-4 mt-3">
                          <button onClick={() => updateQuantity(item._id, item.quantity - 1)} className="w-7 h-7 rounded-full press-3d border border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors">−</button>
                          <span className="text-sm font-mono">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item._id, item.quantity + 1)} className="w-7 h-7 rounded-full press-3d border border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors">+</button>
                          <button onClick={() => removeFromCart(item._id)} className="ml-auto text-xs uppercase tracking-widest text-ink-400 hover:text-ink-900 transition-colors">Remove</button>
                        </div>
                      </div>
                      <p className="font-serif text-lg text-ink-900">₹{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-ink-200 space-y-4">
                  <div>
                    <label className="label-mini">Room number <span className="text-ink-400 normal-case tracking-normal">— if staying with us</span></label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g. R-101"
                      className="input-line"
                    />
                    {roomNumber.trim() && (
                      <p className="text-xs text-ink-400 mt-1">
                        Charges will be added to your room folio.
                      </p>
                    )}
                  </div>

                  <label className="label-mini">A note for the kitchen</label>
                  <textarea
                    rows="2"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Less spice, no onion, allergies…"
                    className="input-line resize-none"
                  />

                  <div className="space-y-2 text-sm pt-4">
                    <div className="flex justify-between text-ink-500 font-light"><span>Subtotal</span><span>₹{subtotal}</span></div>
                    <div className="flex justify-between text-ink-500 font-light"><span>GST (5%)</span><span>₹{gst}</span></div>
                    <div className="flex justify-between font-serif text-2xl text-ink-900 pt-3 border-t border-ink-100"><span>Total</span><span>₹{total}</span></div>
                  </div>

                  <button onClick={placeOrder} disabled={placingOrder} className="btn-primary w-full mt-4 disabled:opacity-50">
                    {placingOrder ? 'Placing order…' : 'Place order'} <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
};

export default Restaurant;
