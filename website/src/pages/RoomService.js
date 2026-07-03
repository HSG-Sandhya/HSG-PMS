import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FOOD_PLACEHOLDER, menuImage } from '../lib/foodImages';

const STATUS_TONE = {
  Pending:      'text-brass-500',
  'In Progress':'text-ink-700',
  Completed:    'text-emerald-700',
  Cancelled:    'text-rose-700',
};

const RoomService = () => {
  const { roomNumber } = useParams();
  const navigate = useNavigate();

  const [roomData, setRoomData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderHistory, setOrderHistory] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const fetchRoomServiceData = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/website/room-service/${roomNumber}`);
      setRoomData(data);
      setMenuItems(data.menuItems);
      setCategories(data.categories);
      const hist = await axios.get(`/api/website/room-service/${roomNumber}/orders`);
      setOrderHistory(hist.data);
    } catch (err) {
      console.error('Error fetching room service data:', err);
      if (err.response?.status === 404) {
        toast.error('Room not found or no active booking');
        navigate('/');
      } else {
        toast.error('Failed to load room service');
      }
    } finally {
      setLoading(false);
    }
  }, [roomNumber, navigate]);

  useEffect(() => { fetchRoomServiceData(); }, [fetchRoomServiceData]);

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
      const orderData = {
        items: cart.map((i) => ({ itemId: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        totalAmount: subtotal,
        specialInstructions,
        customerName: roomData.guest.name,
        customerPhone: roomData.guest.phone,
      };
      const { data } = await axios.post(`/api/website/room-service/${roomNumber}/order`, orderData);
      if (data.success) {
        toast.success(`Order placed · No. ${data.orderNumber}`);
        setCart([]);
        setSpecialInstructions('');
        setCartOpen(false);
        const hist = await axios.get(`/api/website/room-service/${roomNumber}/orders`);
        setOrderHistory(hist.data);
      } else {
        toast.error('Order could not be placed');
      }
    } catch (err) {
      console.error('Error placing order:', err);
      toast.error('Order could not be placed. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const filteredItems = menuItems.filter(
    (i) => selectedCategory === 'all' || (i.category && i.category.name === selectedCategory),
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-bone-100 flex items-center justify-center">
        <div className="w-12 h-12 border border-ink-200 border-t-ink-900 rounded-full animate-spin" />
      </main>
    );
  }

  if (!roomData) {
    return (
      <main className="min-h-screen bg-bone-100 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="eyebrow mb-6">— Not found</p>
          <h2 className="font-serif font-light text-3xl text-ink-900">This room isn’t available for service.</h2>
          <p className="mt-4 text-ink-500 font-light">It may not have an active booking right now.</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-8">Return home</button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-bone-100 min-h-screen">
      {/* Header */}
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 border-b border-ink-100">
        <div className="edge grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <p className="eyebrow mb-6">— Room service · No. {roomData.room.roomNumber}</p>
            <h1 className="font-serif font-light text-ink-900 text-4xl md:text-6xl leading-tight tracking-tight text-balance">
              Welcome, <em className="not-italic text-brass-500">{roomData.guest.name?.split(' ')[0]}</em>.
            </h1>
          </div>
          <div className="md:col-span-4 md:pb-2 text-sm text-ink-500 font-light space-y-1">
            <p>The {roomData.room.type} Room · No. {roomData.room.roomNumber}</p>
            <p>Check-in {new Date(roomData.booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            <p>Check-out {new Date(roomData.booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
      </section>

      <div className="edge py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Menu column */}
        <div className="lg:col-span-8">
          <div className="flex items-center gap-2 md:gap-6 overflow-x-auto pb-6 mb-10 border-b border-ink-100">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`relative whitespace-nowrap text-xs uppercase tracking-widest font-medium px-2 py-2 transition-colors duration-300 ${
                selectedCategory === 'all' ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
              }`}
            >
              All
              {selectedCategory === 'all' && (
                <motion.span layoutId="rs-underline" className="absolute -bottom-0.5 left-2 right-2 h-px bg-ink-900" />
              )}
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`relative whitespace-nowrap text-xs uppercase tracking-widest font-medium px-2 py-2 transition-colors duration-300 ${
                  selectedCategory === cat.name ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
                }`}
              >
                {cat.name}
                {selectedCategory === cat.name && (
                  <motion.span layoutId="rs-underline" className="absolute -bottom-0.5 left-2 right-2 h-px bg-ink-900" />
                )}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-ink-100">
            {filteredItems.map((item, i) => (
              <motion.li
                key={item._id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: (i % 6) * 0.04 }}
                className="py-6 grid grid-cols-12 gap-4 items-center group"
              >
                <div className="col-span-2">
                  <div className="aspect-square overflow-hidden bg-ink-100 rounded-xl shadow-[0_10px_24px_-14px_rgba(26,26,26,0.35)]">
                    <img src={menuImage(item)} alt={item.name} className="w-full h-full object-cover transition-transform duration-[1.2s] ease-editorial group-hover:scale-105" loading="lazy" onError={(e) => { if (e.target.dataset.fallback) return; e.target.dataset.fallback = '1'; e.target.src = FOOD_PLACEHOLDER; }} />
                  </div>
                </div>
                <div className="col-span-7">
                  <h3 className="font-serif font-light text-xl text-ink-900 leading-tight">{item.name}</h3>
                  <p className="mt-1 text-sm text-ink-500 font-light leading-relaxed">
                    {item.description || 'From our kitchen, freshly prepared.'}
                  </p>
                </div>
                <div className="col-span-3 text-right space-y-3">
                  <p className="font-serif text-lg text-ink-900">₹{item.price}</p>
                  <button onClick={() => addToCart(item)} className="text-xs uppercase tracking-widest text-ink-700 hover:text-ink-900 link-underline">
                    Add <span aria-hidden>+</span>
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>

          {filteredItems.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-serif text-xl text-ink-700 font-light">Nothing in this category right now.</p>
            </div>
          )}
        </div>

        {/* History sidebar */}
        <aside className="lg:col-span-4 lg:sticky lg:top-32 self-start">
          <div className="border-t border-ink-200 pt-6">
            <p className="eyebrow mb-2">— Your orders</p>
            <p className="font-serif text-2xl text-ink-900 font-light mb-6">Recent activity</p>

            {orderHistory.length === 0 ? (
              <p className="text-sm text-ink-500 font-light">No orders yet during this stay.</p>
            ) : (
              <ul className="space-y-6">
                {orderHistory.map((order) => (
                  <li key={order._id} className="pb-6 border-b border-ink-100">
                    <div className="flex items-baseline justify-between">
                      <p className="font-serif text-base text-ink-900">No. {order.orderNumber}</p>
                      <p className={`text-xs uppercase tracking-widest ${STATUS_TONE[order.status] || 'text-ink-500'}`}>{order.status}</p>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
                    <div className="mt-3 text-sm text-ink-600 font-light space-y-1">
                      <div className="flex justify-between"><span>Subtotal</span><span>₹{order.totalAmount - (order.gst || 0)}</span></div>
                      <div className="flex justify-between"><span>GST</span><span>₹{order.gst || Math.round(order.totalAmount * 0.05)}</span></div>
                      <div className="flex justify-between font-serif text-ink-900 pt-1"><span>Total</span><span>₹{order.totalAmount}</span></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Floating basket */}
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
            <span className="text-xs uppercase tracking-widest font-medium">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            <span className="block w-px h-4 bg-bone-100/30" />
            <span className="font-serif text-base">₹{total}</span>
            <span className="block w-px h-4 bg-bone-100/30" />
            <span className="text-xs uppercase tracking-widest font-medium">Review →</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-40" onClick={() => setCartOpen(false)} />
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
                  <label className="label-mini">A note for the kitchen</label>
                  <textarea rows="2" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="Less spice, no onion, allergies…" className="input-line resize-none" />

                  <div className="space-y-2 text-sm pt-4">
                    <div className="flex justify-between text-ink-500 font-light"><span>Subtotal</span><span>₹{subtotal}</span></div>
                    <div className="flex justify-between text-ink-500 font-light"><span>GST (5%)</span><span>₹{gst}</span></div>
                    <div className="flex justify-between font-serif text-2xl text-ink-900 pt-3 border-t border-ink-100"><span>Total</span><span>₹{total}</span></div>
                  </div>

                  <button onClick={placeOrder} disabled={placingOrder} className="btn-primary w-full mt-4 disabled:opacity-50">
                    {placingOrder ? 'Placing order…' : 'Place order'} <span aria-hidden>→</span>
                  </button>
                  <p className="text-xs text-ink-400 mt-3">Charged to Room {roomData.room.roomNumber} · Settled on checkout.</p>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
};

export default RoomService;
