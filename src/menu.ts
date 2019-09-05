interface Item {
	element: HTMLElement;
	label: HTMLElement;
	menu?: Menu;
}

class Menu {
	/** The parent menu. */
	private parent: Menu;

	/** Whether this is the highest-level menu. */
	private isRoot: boolean;

	/** Whether this menu is in the open state. */
	private isOpen: boolean;

	/** The menu element. */
	private menu: HTMLElement;

	/** The label element. */
	private label: HTMLElement;

	/** The items which belong to this menu. */
	private items: Item[];

	/** The bound function which closes the menu if an external click is detected. */
	private closeOnOutsideClickBound: EventListenerObject;

	constructor(menu: HTMLElement, label?: HTMLElement, parent?: Menu) {
		// Define the class properties.
		this.parent = parent;
		this.isRoot = !this.parent;
		this.isOpen = this.isRoot;
		this.menu = menu;
		this.label = label;
		this.items = Array.from(Menu.getMenuItems(this.menu)).map(this.createItem.bind(this));
		this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);

		// Configure the menu element.
		this.menu.id = this.menu.id || Menu.generateUniqueID();
		this.menu.setAttribute('role', 'menu');
		this.setMenuAriaLabel();
	}

	private createItem(element: HTMLElement, index: number): Item {
		// Get references to the item components.
		const label = Menu.getItemLabel(element);
		const menu = Menu.getItemMenu(element);

		// Configure the label element.
		label.tabIndex = Menu.getItemTabIndex(index, this.isRoot);
		label.dataset.index = String(index);
		label.setAttribute('role', 'menuitem');
		label.addEventListener('keydown', this.keydownHandler.bind(this));

		// Return the Item, only creating a new Menu if a menu element was found.
		return {element, label, menu: menu ? this.createMenu(menu, label) : null};
	}

	private createMenu(menu: HTMLElement, label: HTMLElement): Menu {
		// Generate unique IDs for the label and menu.
		const labelID = Menu.generateUniqueID();
		const menuID = Menu.generateUniqueID();

		// Configure the label element.
		label.id = labelID;
		label.setAttribute('aria-haspopup', 'true');
		label.setAttribute('aria-controls', menuID);
		label.setAttribute('aria-expanded', 'false');
		label.addEventListener('click', this.clickHandler.bind(this));

		// Configure the menu element.
		menu.id = menuID;
		menu.style.display = 'none';

		// Return a newly created Menu.
		return new Menu(menu, label, this);
	}

	private clickHandler(event: MouseEvent): void {
		// Prevent propagation of this click event.
		event.stopPropagation();

		// Determine the index and the menu for this item.
		const target = event.target as HTMLElement;
		const index = Number(target.dataset.index);
		const menu = this.items[index].menu;

		// Focus the label that was clicked.
		this.focusItem(index);

		// Toggle the visibility state of the menu.
		menu.isOpen ? menu.closeMenu() : menu.openMenu();
	}

	private openMenu(): void {
		// Only continue if there is a menu able to be opened.
		if (this.isRoot || !this.menu || this.isOpen) return;

		// Close any open sibling menus.
		this.closeSiblingMenus();

		// Update the label and menu elements.
		this.label.setAttribute('aria-expanded', 'true');
		this.menu.style.display = 'block';

		// Move the focus.
		this.focusFirstItem();

		// Update the menu visibility state.
		this.isOpen = true;

		// Start listening for outside clicks.
		document.addEventListener('click', this.closeOnOutsideClickBound);
	}

	private closeMenu(): void {
		// Only continue if there is a menu able to be closed.
		if (this.isRoot || !this.menu || !this.isOpen) return;

		// Close any open child menus.
		this.closeChildMenus();

		// Update the label and menu elements.
		this.label.setAttribute('aria-expanded', 'false');
		this.menu.style.display = 'none';

		// Move the focus.
		this.label.focus();

		// Update the menu visibility state.
		this.isOpen = false;

		// Stop listening for outside clicks.
		document.removeEventListener('click', this.closeOnOutsideClickBound);
	}

	private closeSiblingMenus(): void {
		this.parent.items.forEach((item) => {
			// Only continue if this item is a sibling and has a menu.
			if (item.menu === this || !item.menu) return;

			item.menu.closeMenu();
		});
	}

	private closeChildMenus(): void {
		this.items.forEach((item) => {
			// Only continue if this item has a menu.
			if (!item.menu) return;

			item.menu.closeMenu();
		});
	}

	private closeParentMenus(): void {
		// Only continue if the parent is able to be closed.
		if (this.isRoot || this.parent.isRoot) return;

		this.parent.closeMenu();
		this.parent.closeParentMenus();
	}

	private keydownHandler(event: KeyboardEvent): void {
		// Determine the key that was pressed and the index of the label it was pressed on.
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

		// Only continue if the click target is not a descendent of the menu or label.
		if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.label.id}`)) return;

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
		const label = this.items[index].label;

		// Employ roving tabindex for the root menu.
		if (this.isRoot) {
			this.resetTabIndeces();
			label.tabIndex = 0;
		}

		label.focus();
	}

	private resetTabIndeces(): void {
		this.items.forEach((item) => {
			item.label.tabIndex = -1;
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
			const label = this.items[index].label;
			const firstCharacter = Menu.getFirstCharacter(label);

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

	private static getItemLabel(item: HTMLElement): HTMLElement {
		return item.querySelector('.label');
	}

	private static getItemMenu(item: HTMLElement): HTMLElement {
		return item.querySelector('.menu');
	}

	private static generateUniqueID(): string {
		return `menu-${Math.random().toString(36).substr(2, 9)}`;
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

		// Root menu items have a dynamic tabIndex, but initially only the first item is focusable.
		return index === 0 ? 0 : -1;
	}

	private setMenuAriaLabel(): void {
		// Always prefer to reference the label, if it exists.
		if (this.label) {
			this.menu.setAttribute('aria-labelledby', this.label.id);
			return;
		}

		// If there is no label, but there is an aria label, do not change it.
		if (this.menu.getAttribute('aria-label')) return;

		// If there is no label or aria label, resort to a hardcoded aria label.
		this.menu.setAttribute('aria-label', 'Menu');
	}
}
