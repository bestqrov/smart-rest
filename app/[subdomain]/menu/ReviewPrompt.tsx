"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, ExternalLink, CheckCircle } from 'lucide-react'

type SocialLinks = { instagram?: string; googleMaps?: string; tripadvisor?: string }

export default function ReviewPrompt({ cafeName, socialLinks, onClose }: { cafeName: string; socialLinks: SocialLinks; onClose: () => void }) {
  const [rating, setRating] = useState(0)

  return (
    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 flex items-center gap-3 border-b">
        <CheckCircle className="w-8 h-8 text-emerald-500" />
        <div>
          <div className="font-semibold">Success</div>
          <div className="text-sm text-gray-600">Your order was sent to the kitchen</div>
        </div>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700">Close</button>
      </div>

      <div className="p-4">
        <div className="bg-gray-50 p-4 rounded mb-3">
          <div className="font-medium">Enjoying your time at {cafeName}?</div>
          <div className="text-sm text-gray-500">Tap a star to rate your experience</div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {[1,2,3,4,5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className="p-1">
              <Star className={`w-8 h-8 ${s <= rating ? 'text-amber-400' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>

        {rating >= 4 && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Thanks! Would you like to share your experience?</div>
            <div className="flex gap-2">
              {socialLinks.googleMaps && (
                <a href={socialLinks.googleMaps} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 border rounded">
                  <ExternalLink className="w-4 h-4" /> Google Maps
                </a>
              )}
              {socialLinks.tripadvisor && (
                <a href={socialLinks.tripadvisor} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 border rounded">
                  <ExternalLink className="w-4 h-4" /> TripAdvisor
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
