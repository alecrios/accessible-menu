/** An object which manages the data for a menu item. */
interface Item {
	element: HTMLElement;
	button: HTMLElement;
	menu?: Menu;
}

/** An object which defines the open and close animation functions. */
interface Transition {
	open?: (menu: HTMLElement, callback: Function) => void;
	close?: (menu: HTMLElement, callback: Function) => void;
}

/** A utility function for wrapping a function in two requestAnimationFrame functions. */
const doubleRequestAnimationFrame = (callback): void => {
	requestAnimationFrame(() => { requestAnimationFrame(callback); });
};

/** A class which manages the behavior of a navigational menu system. */
class Menu {
	/** The menu element. */
	private menu: HTMLElement;

	/** The button element. */
	private button: HTMLElement;

	/** The transition for this menu. */
	private transition: Transition;

	/** The parent menu. */
	private parent: Menu;

	/** Whether this is the highest-level menu. */
	private isRoot: boolean;

	/** The hierarchical index of the menu. */
	private depth: number;

	/** Whether this can be opened and closed. */
	private isToggleable: boolean;

	/** Whether this is the root menu and there is a menu button. */
	private hasMenuButton: boolean;

	/** Whether this menu is in the open state. */
	private isOpen: boolean;

	/** The items which belong to this menu. */
	private items: Item[];

	/** The transition functions for opening and closing menus. */
	private static transitions = {
		instant: {
			open(menu: HTMLElement, callback: Function): void {
				menu.style.display = 'block';
				callback();
			},
			close(menu: HTMLElement, callback: Function): void {
				menu.style.display = 'none';
				callback();
			},
		},
		fade: {
			open(menu: HTMLElement, callback: Function): void {
				menu.style.opacity = '0';
				menu.style.transition = 'opacity 250ms ease';
				menu.style.display = 'block';

				menu.addEventListener('transitionend', () => {
					callback();
				}, { once: true });

				doubleRequestAnimationFrame(() => { menu.style.opacity = '1'; });
			},
			close(menu: HTMLElement, callback: Function): void {
				menu.style.opacity = '1';
				menu.style.transition = 'opacity 250ms ease';

				menu.addEventListener('transitionend', () => {
					menu.style.display = 'none';
					callback();
				}, { once: true });

				doubleRequestAnimationFrame(() => { menu.style.opacity = '0'; });
			},
		},
		slide: {
			open(menu: HTMLElement, callback: Function): void {
				menu.style.height = '0';
				menu.style.overflow = 'hidden';
				menu.style.transition = 'height 250ms ease-out';
				menu.style.display = 'block';

				menu.addEventListener('transitionend', () => {
					menu.style.removeProperty('height');
					menu.style.removeProperty('overflow');
					menu.style.removeProperty('transition');
					callback();
				}, { once: true });

				doubleRequestAnimationFrame(() => { menu.style.height = `${menu.scrollHeight}px`; });
			},
			close(menu: HTMLElement, callback: Function): void {
				menu.style.height = `${menu.scrollHeight}px`;
				menu.style.overflow = 'hidden';
				menu.style.transition = 'height 250ms ease-out';

				menu.addEventListener('transitionend', () => {
					menu.style.display = 'none';
					menu.style.removeProperty('height');
					menu.style.removeProperty('overflow');
					menu.style.removeProperty('transition');
					callback();
				}, { once: true });

				doubleRequestAnimationFrame(() => { menu.style.height = '0'; });
			},
		},
	}

	constructor(menu: HTMLElement, button?: HTMLElement, parent?: Menu) {
		// Define the class properties.
		this.menu = menu;
		this.button = button;
		this.parent = parent;
		this.isRoot = !this.parent;
		this.depth = this.isRoot ? 0 : this.parent.depth + 1;
		this.transition = this.getTransition();
		this.isToggleable = !!this.button;
		this.hasMenuButton = this.isRoot && !!this.button;
		this.isOpen = !this.isToggleable;
		this.items = Menu.getMenuItems(this.menu).map(this.createItem.bind(this));
		this.closeOnOutsideClick = this.closeOnOutsideClick.bind(this);

		// Configure elements.
		this.setMenuAndButtonID();
		this.setMenuRole();
		this.setMenuAriaLabel();
		this.configureButton();
	}

	private setMenuAndButtonID(): void {
		// Prefer to keep the existing ID, but fallback to a random string if necessary.
		this.menu.id = this.menu.id || Menu.generateUniqueID();

		// Only continue if this menu is toggleable via a menu button.
		if (!this.hasMenuButton) return;

		// Prefer to keep the existing ID, but fallback to a random string if necessary.
		this.button.id = this.button.id || Menu.generateUniqueID();
	}

	private setMenuRole(): void {
		// If the menu is toggleable, `menu`. If it's visually persistent, `menubar`.
		this.menu.setAttribute('role', this.isToggleable ? 'menu' : 'menubar');
	}

	private setMenuAriaLabel(): void {
		// Always prefer to reference the button, if it exists.
		if (this.button) {
			this.menu.setAttribute('aria-labelledby', this.button.id);
			return;
		}

		// If there is no button, but there is an aria label, do not change it.
		if (this.menu.getAttribute('aria-label')) return;

		// If there is no button or aria label, resort to a hardcoded aria label.
		this.menu.setAttribute('aria-label', 'Menu');
	}

	private configureButton(): void {
		// Only continue if a menu button exists.
		if (!this.hasMenuButton) return;

		// Set the aria label if no discernible text is found.
		if (!this.button.innerText && !this.button.getAttribute('aria-label')) {
			this.button.setAttribute('aria-label', 'Menu Button');
		}

		// Configure the rest of the button's attributes and behavior.
		this.button.setAttribute('role', 'button');
		this.button.setAttribute('aria-haspopup', 'true');
		this.button.setAttribute('aria-expanded', 'false');
		this.button.setAttribute('aria-controls', this.menu.id);
		this.button.addEventListener('click', this.menuButtonClickHandler.bind(this));
	}

	private createItem(element: HTMLElement, index: number): Item {
		// Get references to the item components.
		const button = Menu.getItemButton(element);
		const menu = Menu.getItemMenu(element);

		// Configure the button element.
		button.tabIndex = Menu.getItemTabIndex(index, this.isRoot);
		button.dataset.index = String(index);
		button.setAttribute('role', 'menuitem');
		button.addEventListener('keydown', this.keydownHandler.bind(this));

		// Return the Item, only creating a new Menu if a menu element is found.
		return menu !== null
			? { element, button, menu: this.createMenu(menu, button) }
			: { element, button };
	}

	private createMenu(menu: HTMLElement, button: HTMLElement): Menu {
		// Generate unique IDs for the menu and button.
		const buttonID = Menu.generateUniqueID();
		const menuID = Menu.generateUniqueID();

		// Configure the button element.
		button.id = buttonID;
		button.setAttribute('aria-haspopup', 'true');
		button.setAttribute('aria-controls', menuID);
		button.setAttribute('aria-expanded', 'false');
		button.addEventListener('click', this.buttonClickHandler.bind(this));

		// Configure the menu element.
		menu.id = menuID;
		menu.style.display = 'none';

		// Return a newly created Menu.
		return new Menu(menu, button, this);
	}

	private menuButtonClickHandler(): void {
		// Toggle the visibility state of the menu.
		this.isOpen ? this.closeMenu() : this.openMenu();
	}

	private buttonClickHandler(event: MouseEvent): void {
		// Prevent propagation of this click event.
		event.stopPropagation();

		// Determine the index and the menu for this item.
		const target = event.target as HTMLElement;
		const button = target.closest('.button') as HTMLElement;
		const index = Number(button.dataset.index);
		const menu = this.items[index].menu;

		// Focus the button that was clicked.
		this.focusItem(index);

		// Toggle the visibility state of the menu.
		menu.isOpen ? menu.closeMenu() : menu.openMenu();
	}

	private openMenu(): void {
		// Only continue if there is a menu able to be opened.
		if (!this.menu || !this.isToggleable || this.isOpen) return;

		// Update the menu visibility state.
		this.isOpen = true;

		// Update the button element.
		this.button.setAttribute('aria-expanded', 'true');

		// Start listening for outside clicks.
		document.addEventListener('click', this.closeOnOutsideClick);

		// Close any open sibling menus.
		this.closeSiblingMenus();

		// Dispatch the event.
		this.menu.dispatchEvent(new CustomEvent('menuopen'));

		// Get the transition function.
		const transition = this.transition.open;

		// Run the transition function.
		transition(this.menu, () => {});

		// Perform some actions once the layout has updated.
		doubleRequestAnimationFrame(() => {
			// If the button controlling this menu uses roving tab index, disable focusability.
			if (this.hasMenuButton || this.parent.isRoot) {
				this.button.tabIndex = -1;
			}

			// Send focus to the first item in the menu.
			this.focusFirstItem();
		});
	}

	private closeMenu({ closeInstantly = false, skipFocus = false } = {}): void {
		// Only continue if there is a menu able to be closed.
		if (!this.menu || !this.isToggleable || !this.isOpen) return;

		// Update the menu visibility state.
		this.isOpen = false;

		// Update the button element.
		this.button.setAttribute('aria-expanded', 'false');

		// Stop listening for outside clicks.
		document.removeEventListener('click', this.closeOnOutsideClick);

		// Dispatch the event.
		this.menu.dispatchEvent(new CustomEvent('menuclose'));

		// Get the transition function.
		const transition = closeInstantly ? Menu.transitions.instant.close : this.transition.close;

		// Run the transition function.
		transition(this.menu, () => { this.closeChildMenus(); });

		// Perform some actions once the layout has updated.
		doubleRequestAnimationFrame(() => {
			// If the button controlling this menu uses roving tab index, enable focusability.
			if (this.hasMenuButton || this.parent.isRoot) {
				this.button.tabIndex = 0;
			}

			// Send focus to the button for the menu.
			if (!closeInstantly && !skipFocus) {
				this.button.focus();
			}
		});
	}

	private closeSiblingMenus(): void {
		if (!this.parent) return;

		this.parent.items.forEach((item) => {
			// Only continue if this item is a sibling and has a menu.
			if (item.menu === this || !item.menu) return;

			// Close the menu.
			item.menu.closeMenu({ skipFocus: true });
		});
	}

	private closeChildMenus(): void {
		this.items.forEach((item) => {
			// Only continue if this item has a menu.
			if (!item.menu) return;

			// Close the the menu.
			item.menu.closeMenu({ closeInstantly: true, skipFocus: true });
		});
	}

	private closeAllMenus(): void {
		// If this is the root menu and it is toggleable, close it.
		if (this.isRoot) {
			if (this.isToggleable) {
				this.closeMenu({ skipFocus: true });
			}

			return;
		}

		// If this is the root menu's child menu and the root is not toggleable, close it.
		if (this.parent.isRoot && !this.parent.isToggleable) {
			this.closeMenu({ skipFocus: true });
			return;
		}

		// Continue looking for the highest toggleable menu.
		this.parent.closeAllMenus();
	}

	private keydownHandler(event: KeyboardEvent): void {
		// Determine the key that was pressed and the index of the button it was pressed on.
		const key = event.key;
		const target = event.target as HTMLElement;
		const index = Number(target.dataset.index);

		let preventDefault = false;

		if (key === 'Escape') {
			this.closeMenu();
		} else if (key === 'Tab') {
			this.closeAllMenus();
		} else if (key === 'ArrowLeft' || key === 'ArrowUp') {
			this.focusPreviousItem(index);
			preventDefault = true;
		} else if (key === 'ArrowRight' || key === 'ArrowDown') {
			this.focusNextItem(index);
			preventDefault = true;
		} else if (key === 'Home' || key === 'PageUp') {
			this.focusFirstItem();
			preventDefault = true;
		} else if (key === 'End' || key === 'PageDown') {
			this.focusLastItem();
			preventDefault = true;
		} else if (Menu.isPrintableCharacter(key)) {
			this.focusNextCharacterMatch(index, key);
		}

		if (preventDefault) {
			event.stopPropagation();
			event.preventDefault();
		}
	}

	private closeOnOutsideClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;

		// Only continue if the click target is not a descendent of the menu or button.
		if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.button.id}`)) return;

		this.closeAllMenus();
	}

	private focusPreviousItem(currentIndex: number): void {
		this.focusItem(currentIndex === 0 ? this.items.length - 1 : currentIndex - 1);
	}

	private focusNextItem(currentIndex: number): void {
		this.focusItem(currentIndex === this.items.length - 1 ? 0 : currentIndex + 1);
	}

	private focusFirstItem(): void {
		this.focusItem(0);
	}

	private focusLastItem(): void {
		this.focusItem(this.items.length - 1);
	}

	private focusItem(index: number): void {
		const button = this.items[index].button;

		// Employ roving tab index for the root menu.
		if (this.isRoot) {
			this.resetTabIndeces();
			button.tabIndex = 0;
		}

		button.focus();
	}

	private resetTabIndeces(): void {
		this.items.forEach((item) => {
			item.button.tabIndex = -1;
		});
	}

	private focusNextCharacterMatch(currentIndex: number, character: string): void {
		// Define search bounds.
		const startIndex = currentIndex + 1;
		const endIndex = this.items.length;

		// Search for a match after the current item.
		let matchIndex = this.getNextCharacterMatch(character, startIndex, endIndex);

		// If not found, search for a match before the current item.
		if (matchIndex === -1) {
			matchIndex = this.getNextCharacterMatch(character, 0, currentIndex);
		}

		// If found, focus the item.
		if (matchIndex !== -1) {
			this.focusItem(matchIndex);
		}
	}

	private getNextCharacterMatch(character: string, startIndex: number, endIndex: number): number {
		// Iterate through the specified range.
		for (let index = startIndex; index < endIndex; index += 1) {
			// Get the first character of this menu item.
			const button = this.items[index].button;
			const firstCharacter = Menu.getFirstCharacter(button);

			// If the first character is a match, return the index.
			if (firstCharacter.toLowerCase() === character.toLowerCase()) {
				return index;
			}
		}

		// No match found.
		return -1;
	}

	private getTransition(): Transition {
		return Object.keys(Menu.transitions).includes(this.menu.dataset.transition)
			? Menu.transitions[this.menu.dataset.transition]
			: Menu.transitions.instant;
	}

	private static getMenuItems(menu: HTMLElement): HTMLElement[] {
		let items = Array.from(menu.querySelectorAll('.item') as NodeListOf<HTMLElement>);

		// Keep only the child items, filtering out further descedents.
		items = items.filter((item) => item.closest('.menu') === menu);

		return items;
	}

	private static getItemButton(item: HTMLElement): HTMLElement {
		return item.querySelector('.button');
	}

	private static getItemMenu(item: HTMLElement): HTMLElement {
		return item.querySelector('.menu');
	}

	private static generateUniqueID(): string {
		return `m${Math.random().toString(36).substr(2, 9)}`;
	}

	private static isPrintableCharacter(string: string): boolean {
		return string.length === 1 && string.match(/\S/) !== null;
	}

	private static getFirstCharacter(element: HTMLElement): string {
		return element.textContent.trim().substring(0, 1);
	}

	private static getItemTabIndex(index: number, isInRootMenu: boolean): number {
		// Children menu items are only ever focusable programmatically.
		if (!isInRootMenu) return -1;

		// Root menu items have a dynamic tab index, but initially only the first item is focusable.
		return index === 0 ? 0 : -1;
	}
}
