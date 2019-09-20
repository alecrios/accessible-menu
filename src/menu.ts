/** An object which manages the data for a menu item. */
interface Item {
	element: HTMLElement;
	button: HTMLElement;
	menu?: Menu;
}

/** The options for a menu instance. */
interface Options {
	/* The array of transitions, where the index corresponds to the depth of the menu. */
	transitions?: [{
		open: (menu: HTMLElement) => void;
		close: (menu: HTMLElement) => void;
		applyToChildren?: boolean;
	}];
}

/** A class which manages the behavior of a navigational menu system. */
class Menu {
	/** The menu element. */
	private menu: HTMLElement;

	/** The button element. */
	private button: HTMLElement;

	/** The menu options. */
	private options: Options;

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

	/** The bound function which closes the menu if an external click is detected. */
	private closeOnOutsideClickBound: EventListenerObject;

	/** The publicly available transition functions for opening and closing menus. */
	public static transitions = {
		instant: {
			open(menu, callback): void {
				menu.style.display = 'block';
				callback();
			},
			close(menu, callback): void {
				menu.style.display = 'none';
				callback();
			},
		},
		fade: {
			open(menu, callback): void {
				menu.style.opacity = '0';
				menu.style.transition = 'opacity 125ms ease';
				menu.style.display = 'block';

				menu.addEventListener('transitionend', () => {
					callback();
				}, {once: true});

				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						menu.style.opacity = '1';
					});
				});

				callback();
			},
			close(menu, callback): void {
				menu.style.opacity = '1';
				menu.style.transition = 'opacity 125ms ease';

				menu.addEventListener('transitionend', () => {
					menu.style.display = 'none';
					callback();
				}, {once: true});

				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						menu.style.opacity = '0';
					});
				});
			},
		},
	}

	constructor(menu: HTMLElement, button?: HTMLElement, options?: Options, parent?: Menu) {
		// Define the class properties.
		this.menu = menu;
		this.button = button;
		this.options = options;
		this.parent = parent;
		this.isRoot = !this.parent;
		this.depth = this.isRoot ? 0 : this.parent.depth + 1;
		this.isToggleable = !!this.button;
		this.hasMenuButton = this.isRoot && !!this.button;
		this.isOpen = !this.isToggleable;
		this.items = Array.from(Menu.getMenuItems(this.menu)).map(this.createItem.bind(this));
		this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);

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
			? {element, button, menu: this.createMenu(menu, button)}
			: {element, button};
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
		return new Menu(menu, button, this.options, this);
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
		const index = Number(target.dataset.index);
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
		document.addEventListener('click', this.closeOnOutsideClickBound);

		// Run the transition animation.
		const transition = this.getTransition('open');
		transition(this.menu, () => {
			this.focusFirstItem();
			this.closeSiblingMenus();
		});
	}

	private closeMenu(instant = false): void {
		// Only continue if there is a menu able to be closed.
		if (!this.menu || !this.isToggleable || !this.isOpen) return;

		// Update the menu visibility state.
		this.isOpen = false;

		// Update the button element.
		this.button.setAttribute('aria-expanded', 'false');

		// Stop listening for outside clicks.
		document.removeEventListener('click', this.closeOnOutsideClickBound);

		// Run the transition animation.
		const transition = instant ? Menu.transitions.instant.close : this.getTransition('close');
		transition(this.menu, () => {
			this.button.focus();
			this.closeChildMenus();
		});
	}

	// TODO: Clean up this function.
	private getTransition(type: 'open' | 'close'): Function {
		// Check for a provided transition function.
		if (
			this.options
			&& this.options.transitions
			&& this.options.transitions[this.depth]
			&& this.options.transitions[this.depth][type]
		) {
			return this.options.transitions[this.depth][type];
		}

		// Check if an ancester menu's transition settings apply to children.
		if (!this.isRoot) {
			for (let index = this.depth - 1; index >= 0; index -= 1) {
				if (
					this.options
					&& this.options.transitions
					&& this.options.transitions[index]
					&& this.options.transitions[index].applyToChildren
				) {
					return this.options.transitions[index][type];
				}
			}
		}

		// Default to the instant transition function.
		return Menu.transitions.instant[type];
	}

	private closeSiblingMenus(): void {
		if (!this.parent) return;

		this.parent.items.forEach((item) => {
			// Only continue if this item is a sibling and has a menu.
			if (item.menu === this || !item.menu) return;

			// Close the menu.
			item.menu.closeMenu();
		});
	}

	private closeChildMenus(): void {
		this.items.forEach((item) => {
			// Only continue if this item has a menu.
			if (!item.menu) return;

			// Close the the menu instantly, because its parent is already closed.
			item.menu.closeMenu(true);
		});
	}

	private closeParentMenus(): void {
		// Only continue if there is a parent menu to close.
		if (!this.parent) return;

		// Don't close the parent menu if it is the root menu, unless it has a menu button.
		if (this.parent.isRoot && !this.parent.hasMenuButton) return;

		this.parent.closeMenu();
		this.parent.closeParentMenus();
	}

	private keydownHandler(event: KeyboardEvent): void {
		// Determine the key that was pressed and the index of the button it was pressed on.
		const key = event.key;
		const target = event.target as HTMLElement;
		const index = Number(target.dataset.index);

		if (key === 'Escape') {
			this.closeMenu();
		} else if (key === 'Tab') {
			this.closeMenu();
			this.closeParentMenus();
		} else if (key === 'ArrowLeft' || key === 'ArrowUp') {
			this.focusPreviousItem(index);
		} else if (key === 'ArrowRight' || key === 'ArrowDown') {
			this.focusNextItem(index);
		} else if (key === 'Home' || key === 'PageUp') {
			this.focusFirstItem();
		} else if (key === 'End' || key === 'PageDown') {
			this.focusLastItem();
		} else if (Menu.isPrintableCharacter(key)) {
			this.focusNextCharacterMatch(index, key);
		}
	}

	private closeOnOutsideClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;

		// Only continue if the click target is not a descendent of the menu or button.
		if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.button.id}`)) return;

		this.closeMenu();
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

	private static getMenuItems(menu: HTMLElement): NodeListOf<HTMLElement> {
		return menu.querySelectorAll(':scope > .item');
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
		return element.textContent.substring(0, 1);
	}

	private static getItemTabIndex(index: number, isInRootMenu: boolean): number {
		// Children menu items are only ever focusable programmatically.
		if (!isInRootMenu) return -1;

		// Root menu items have a dynamic tab index, but initially only the first item is focusable.
		return index === 0 ? 0 : -1;
	}
}
