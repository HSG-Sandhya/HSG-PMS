// Shared menu-image resolver for the Restaurant and Room Service pages.
//
// Prefer the real photo saved on the item; fall back to a local placeholder so
// a card never renders empty. Swap public/images/dining.jpg to change it.
export const FOOD_PLACEHOLDER = '/images/dining.jpg';

export const menuImage = (item) => ((item?.image || '').trim()) || FOOD_PLACEHOLDER;
