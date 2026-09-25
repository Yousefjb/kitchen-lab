// The kitchens a family can choose in the parents' corner, in menu order.
// The first one is where new players start. To add a kitchen, make a file like
// kitchen.js next to this one and list it here.
import kitchen from './kitchen.js';
import bakery from './bakery.js';

export const KITCHEN_DEFS = [kitchen, bakery];
