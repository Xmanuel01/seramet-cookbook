# Seramet Cookbook

Seramet Cookbook is a clean, mobile-first restaurant recipe and kitchen standards application for Mona Swahili. It is being developed as a separate application now, while keeping the same visual language and future integration model as Seramet POS.

## Current v0.1 scope

- Seramet design tokens and Plus Jakarta Sans typography
- Mobile-first cookbook home
- Floating bottom navigation for phones
- Responsive Seramet-style sidebar for desktop
- Recipe search and category filtering
- Recipe detail view with ingredients, method and kitchen notes
- Working multi-step recipe editor foundation
- Category view
- Word cookbook import/review interface
- Installable-app manifest foundation

## Run locally

1. npm install
2. npm run dev

## Production build

npm run build

## Architecture direction

The UI is intentionally simpler than the full POS. Future backend milestones will add Supabase, authentication, recipe version history, DOCX parsing and integration with Seramet items, inventory, production and food costing.
