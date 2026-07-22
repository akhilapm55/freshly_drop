/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, ShieldCheck, Heart, Info, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  key?: string | number;
}

export default function ProductCard({
  product,
  cartQuantity,
  onAddToCart,
  onRemoveFromCart,
}: ProductCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        className="relative bg-white rounded-[20px] border border-gray-100 p-2.5 card-shadow transition-all duration-300 flex flex-col justify-between overflow-hidden group"
      >
        {/* Popular / Best Seller Green Highlight Ribbon */}
        {product.popular && (
          <div className="absolute top-2 left-2 z-10 bg-[#1B7A36] text-white text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <ShieldCheck className="w-3 h-3" />
            <span>Farm Choice</span>
          </div>
        )}

        {/* Wishlist toggle using gold accent */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className="absolute top-2 right-2 z-10 p-2 bg-white/90 backdrop-blur-xs rounded-full shadow-xs text-gray-400 hover:text-[#D9AB3B] hover:scale-110 active:scale-95 transition-all duration-200"
          id={`wishlist-button-${product.id}`}
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isFavorite ? 'fill-[#D9AB3B] stroke-[#D9AB3B]' : 'stroke-gray-400'
            }`}
          />
        </button>

        {/* Product Image Area */}
        <div 
          className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2 cursor-pointer"
          onClick={() => setShowDetailModal(true)}
        >
          <img
            referrerPolicy="no-referrer"
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/20 to-transparent p-2 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] text-white bg-[#1B7A36]/90 px-2 py-0.5 rounded-sm font-semibold flex items-center gap-1">
              <Info className="w-3 h-3" /> Quick View
            </span>
          </div>
        </div>

        {/* Product Details info — centered */}
        <div className="flex-1 flex flex-col items-center text-center">
          {/* Rating stars & info */}
          <div className="flex items-center justify-center gap-1.5 mb-0.5 text-xs">
            <div className="flex items-center text-[#D9AB3B]">
              <Star className="w-3 h-3 fill-current" />
              <span className="font-medium text-[#222222] ml-1">{product.rating}</span>
            </div>
            <span className="text-gray-300">•</span>
            <span className="text-[10px] text-gray-500 font-normal">Organic Cert.</span>
          </div>

          <h3
            className="font-sans font-normal text-[13px] text-[#222222] line-clamp-2 leading-snug cursor-pointer hover:text-[#1B7A36]"
            onClick={() => setShowDetailModal(true)}
          >
            {product.name}
          </h3>

          <p className="text-[11px] text-gray-400 font-normal mt-0.5 mb-2">
            {product.unit}
          </p>
        </div>

        {/* Action Bottom Area — centered price + compact add button */}
        <div className="flex flex-col items-center gap-1.5 mt-auto pt-2 border-t border-gray-50">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium line-through">
              ₹{Math.round(product.price * 1.2)}
            </span>
            <span className="text-sm font-semibold text-[#222222]">
              ₹{product.price}
            </span>
          </div>

          {/* Compact add button / quantity controls */}
          <div className="h-7 w-20 relative flex items-center justify-center">
            <AnimatePresence mode="wait">
              {cartQuantity === 0 ? (
                <motion.button
                  key="add-btn"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => onAddToCart(product)}
                  className="w-full h-full bg-white text-[#1B7A36] hover:bg-[#1B7A36]/5 border border-[#1B7A36] font-semibold text-[11px] uppercase tracking-wide rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-0.5 active:scale-95 transition-all"
                  style={{ borderColor: '#1B7A36', color: '#1B7A36' }}
                  id={`add-to-cart-${product.id}`}
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>ADD</span>
                </motion.button>
              ) : (
                <motion.div
                  key="quantity-controls"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full h-full bg-[#1B7A36] text-white font-bold rounded-lg flex items-center justify-between px-1.5 shadow-xs"
                  style={{ backgroundColor: '#1B7A36' }}
                >
                  <button
                    onClick={() => onRemoveFromCart(product)}
                    className="p-0.5 hover:bg-white/10 rounded-sm transition-colors cursor-pointer"
                    id={`decrease-qty-${product.id}`}
                  >
                    <Minus className="w-3 h-3 stroke-[3]" />
                  </button>
                  <span className="text-[11px] font-semibold select-none">
                    {cartQuantity}
                  </span>
                  <button
                    onClick={() => onAddToCart(product)}
                    className="p-0.5 hover:bg-white/10 rounded-sm transition-colors cursor-pointer"
                    id={`increase-qty-${product.id}`}
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Low Stock indicator */}
        {product.stock <= 15 && product.stock > 0 && (
          <span 
            className="text-[9px] text-center font-bold block mt-2" 
            style={{ color: '#D9AB3B' }}
          >
            Only {product.stock} items left in stock
          </span>
        )}
        {product.stock === 0 && (
          <span className="text-[10px] text-center font-bold text-red-500 block mt-2 uppercase">
            Sold Out
          </span>
        )}
      </motion.div>

      {/* DETAIL DEEP DIVE MODAL */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Ambient Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl z-10 p-5 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Left Column: Product Image */}
              <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-64 rounded-2xl overflow-hidden bg-gray-50 relative">
                <img
                  referrerPolicy="no-referrer"
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {product.popular && (
                  <div className="absolute top-3 left-3 bg-[#1B7A36] text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-md">
                    Popular
                  </div>
                )}
              </div>

              {/* Right Column: Details Content */}
              <div className="w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span 
                      className="text-xs font-bold uppercase tracking-wide text-brand-green-primary"
                      style={{ color: '#1B7A36' }}
                    >
                      {product.category}
                    </span>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                      id="close-detail-modal"
                    >
                      ✕
                    </button>
                  </div>

                  <h2 className="serif text-xl font-bold text-gray-950 leading-tight mb-2">
                    {product.name}
                  </h2>

                  {/* Rating Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center text-[#D9AB3B]">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating)
                              ? 'fill-current'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                      {product.rating} / 5.0
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed mb-4">
                    {product.description}
                  </p>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Unit weight:</span>
                      <span className="font-semibold text-gray-900">{product.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cultivation:</span>
                      <span className="font-semibold text-[#1B7A36]" style={{ color: '#1B7A36' }}>100% Organic certified</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Source:</span>
                      <span className="font-semibold text-gray-900">Alappuzha Farm Cooperatives, Kerala</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-400 font-medium line-through">
                      ₹{Math.round(product.price * 1.2)}
                    </span>
                    <span className="text-2xl font-bold text-gray-950">
                      ₹{product.price}
                    </span>
                  </div>

                  {/* Add to Cart button */}
                  <div className="h-10 w-32">
                    {cartQuantity === 0 ? (
                      <button
                        onClick={() => {
                          onAddToCart(product);
                        }}
                        className="w-full h-full bg-[#1B7A36] text-white hover:bg-[#1B7A36]/90 font-semibold text-xs uppercase tracking-wide py-2 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        style={{ backgroundColor: '#1B7A36' }}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Add To Cart</span>
                      </button>
                    ) : (
                      <div
                        className="w-full h-full bg-[#1B7A36] text-white font-bold rounded-xl flex items-center justify-between px-3 shadow-md"
                        style={{ backgroundColor: '#1B7A36' }}
                      >
                        <button
                          onClick={() => onRemoveFromCart(product)}
                          className="p-1 hover:bg-white/10 rounded-sm transition-colors cursor-pointer"
                        >
                          <Minus className="w-4 h-4 stroke-[3]" />
                        </button>
                        <span className="text-sm font-semibold select-none">
                          {cartQuantity}
                        </span>
                        <button
                          onClick={() => onAddToCart(product)}
                          className="p-1 hover:bg-white/10 rounded-sm transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
