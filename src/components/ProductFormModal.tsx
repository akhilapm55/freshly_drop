/**
 * Add / edit product modal for the Admin Dashboard.
 * Handles its own form state and a saving spinner; the parent supplies onSave
 * which persists to Supabase and may throw (errors are shown inline).
 */
import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, ImageOff, Link2, Upload } from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../data';
import { fileToCompressedDataUrl } from '../lib/image';

interface ProductFormModalProps {
  mode: 'add' | 'edit';
  initial?: Product;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

// Selectable categories exclude the "All" filter pseudo-category.
const PRODUCT_CATEGORIES = CATEGORIES.map((c) => c.name).filter((n) => n !== 'All');

export default function ProductFormModal({ mode, initial, onClose, onSave }: ProductFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? PRODUCT_CATEGORIES[0]);
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [image, setImage] = useState(initial?.image ?? '');
  const [stock, setStock] = useState(initial?.stock?.toString() ?? '0');
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '4.5');
  const [popular, setPopular] = useState(initial?.popular ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Image source: paste a URL or upload a file from the device
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      // Compress in the browser to a small data URL saved straight in the DB —
      // no network upload, so it can't be cut off by a flaky connection.
      const dataUrl = await fileToCompressedDataUrl(file);
      setImage(dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not process that image. Please try another.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // allow re-selecting same file
    }
  }

  async function handleSubmit() {
    setError('');
    if (!name.trim()) return setError('Product name is required.');
    if (!price || Number(price) <= 0) return setError('Enter a valid price.');
    if (!unit.trim()) return setError('Unit is required (e.g. "1 kg", "500 ml").');
    if (!image.trim()) return setError('Please add a product image (URL or upload).');
    if (uploading) return setError('Please wait for the image to finish processing.');

    const product: Product = {
      // Keep existing id on edit; generate a stable unique id on add.
      id: initial?.id ?? 'prod-' + Date.now().toString(36),
      name: name.trim(),
      category,
      price: Number(price),
      unit: unit.trim(),
      description: description.trim(),
      image: image.trim(),
      stock: Math.max(0, parseInt(stock) || 0),
      rating: Math.min(5, Math.max(0, Number(rating) || 0)),
      popular,
    };

    setSaving(true);
    try {
      await onSave(product);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save the product. Please try again.');
      setSaving(false);
    }
  }

  const inputClass =
    'w-full bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl p-2.5 text-xs font-medium text-gray-800 outline-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={saving ? undefined : onClose}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md max-h-[88vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <h3 className="font-bold text-base text-[#222222]">
            {mode === 'add' ? '🌱 Add New Product' : '✏️ Edit Product'}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 cursor-pointer disabled:opacity-50"
            id="product-form-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Product image — paste a URL or upload from device */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block">Product Image</label>

            {/* Mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setImageMode('url')}
                className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  imageMode === 'url' ? 'bg-white text-[#1B7A36] shadow-xs' : 'text-gray-500'
                }`}
                id="image-mode-url"
              >
                <Link2 className="w-3 h-3" /> Paste URL
              </button>
              <button
                type="button"
                onClick={() => setImageMode('upload')}
                className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  imageMode === 'upload' ? 'bg-white text-[#1B7A36] shadow-xs' : 'text-gray-500'
                }`}
                id="image-mode-upload"
              >
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Live preview */}
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300 flex-shrink-0 relative">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#1B7A36]" />
                ) : image ? (
                  <img referrerPolicy="no-referrer" src={image} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1">
                {imageMode === 'url' ? (
                  <input
                    className={inputClass}
                    value={image || ''}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://…"
                    id="product-image"
                  />
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelected}
                      className="hidden"
                      id="product-image-file"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-[#1B7A36] hover:bg-[#1B7A36]/5 rounded-xl text-xs font-bold text-gray-600 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Processing…' : image ? 'Choose a different image' : 'Choose image from device'}
                    </button>
                    <p className="text-[9px] text-gray-400 mt-1">JPG/PNG/WebP. Compressed and saved with the product in your database.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Product Name</label>
            <input className={inputClass} value={name || ''} onChange={(e) => setName(e.target.value)} placeholder="e.g. Organic Wayanad Coffee" id="product-name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Category</label>
              <select className={inputClass} value={category || PRODUCT_CATEGORIES[0]} onChange={(e) => setCategory(e.target.value)} id="product-category">
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Unit</label>
              <input className={inputClass} value={unit || ''} onChange={(e) => setUnit(e.target.value)} placeholder="1 kg / 500 ml / 1 pc" id="product-unit" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Price ₹</label>
              <input type="number" className={inputClass} value={price || ''} onChange={(e) => setPrice(e.target.value)} placeholder="0" id="product-price" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Stock</label>
              <input type="number" className={inputClass} value={stock || ''} onChange={(e) => setStock(e.target.value)} placeholder="0" id="product-stock" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Rating</label>
              <input type="number" step="0.1" min="0" max="5" className={inputClass} value={rating || ''} onChange={(e) => setRating(e.target.value)} placeholder="4.5" id="product-rating" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Description</label>
            <textarea className={inputClass + ' resize-none h-20'} value={description || ''} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of the produce…" id="product-description" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} className="w-4 h-4 accent-[#1B7A36]" id="product-popular" />
            <span className="text-xs font-bold text-gray-700">Mark as Popular ⭐</span>
          </label>

          {error && <p className="text-[11px] text-red-500 font-bold bg-red-50 rounded-lg py-2 px-3">{error}</p>}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs uppercase tracking-wide rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 text-white font-semibold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: '#1B7A36' }}
            id="product-form-save"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <span>{mode === 'add' ? 'Add Product' : 'Save Changes'}</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
