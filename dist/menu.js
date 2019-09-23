/** A utility function for wrapping a function in two requestAnimationFrame functions. */
const doubleRequestAnimationFrame = (callback) => {
    requestAnimationFrame(() => { requestAnimationFrame(callback); });
};
/** A class which manages the behavior of a navigational menu system. */
class Menu {
    constructor(menu, button, transitions, parent) {
        // Define the class properties.
        this.menu = menu;
        this.button = button;
        this.transitions = transitions;
        this.parent = parent;
        this.isRoot = !this.parent;
        this.depth = this.isRoot ? 0 : this.parent.depth + 1;
        this.transition = this.getTransition(this.transitions, this.depth);
        this.isToggleable = !!this.button;
        this.hasMenuButton = this.isRoot && !!this.button;
        this.isOpen = !this.isToggleable;
        this.items = Menu.getMenuItems(this.menu).map(this.createItem.bind(this));
        this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);
        // Configure elements.
        this.setMenuAndButtonID();
        this.setMenuRole();
        this.setMenuAriaLabel();
        this.configureButton();
    }
    setMenuAndButtonID() {
        // Prefer to keep the existing ID, but fallback to a random string if necessary.
        this.menu.id = this.menu.id || Menu.generateUniqueID();
        // Only continue if this menu is toggleable via a menu button.
        if (!this.hasMenuButton)
            return;
        // Prefer to keep the existing ID, but fallback to a random string if necessary.
        this.button.id = this.button.id || Menu.generateUniqueID();
    }
    setMenuRole() {
        // If the menu is toggleable, `menu`. If it's visually persistent, `menubar`.
        this.menu.setAttribute('role', this.isToggleable ? 'menu' : 'menubar');
    }
    setMenuAriaLabel() {
        // Always prefer to reference the button, if it exists.
        if (this.button) {
            this.menu.setAttribute('aria-labelledby', this.button.id);
            return;
        }
        // If there is no button, but there is an aria label, do not change it.
        if (this.menu.getAttribute('aria-label'))
            return;
        // If there is no button or aria label, resort to a hardcoded aria label.
        this.menu.setAttribute('aria-label', 'Menu');
    }
    configureButton() {
        // Only continue if a menu button exists.
        if (!this.hasMenuButton)
            return;
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
    createItem(element, index) {
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
    createMenu(menu, button) {
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
        return new Menu(menu, button, this.transitions, this);
    }
    menuButtonClickHandler() {
        // Toggle the visibility state of the menu.
        this.isOpen ? this.closeMenu() : this.openMenu();
    }
    buttonClickHandler(event) {
        // Prevent propagation of this click event.
        event.stopPropagation();
        // Determine the index and the menu for this item.
        const target = event.target;
        const index = Number(target.dataset.index);
        const menu = this.items[index].menu;
        // Focus the button that was clicked.
        this.focusItem(index);
        // Toggle the visibility state of the menu.
        menu.isOpen ? menu.closeMenu() : menu.openMenu();
    }
    openMenu() {
        // Only continue if there is a menu able to be opened.
        if (!this.menu || !this.isToggleable || this.isOpen)
            return;
        // Update the menu visibility state.
        this.isOpen = true;
        // Update the button element.
        this.button.setAttribute('aria-expanded', 'true');
        // Start listening for outside clicks.
        document.addEventListener('click', this.closeOnOutsideClickBound);
        // Close any open sibling menus.
        this.closeSiblingMenus();
        // Get the transition function.
        const transition = this.transition.open;
        // Run the transition function.
        transition(this.menu, () => { });
        doubleRequestAnimationFrame(() => {
            //
            if (this.hasMenuButton || this.parent.isRoot) {
                this.button.tabIndex = -1;
            }
            // Send focus to the first item in the menu.
            this.focusFirstItem();
        });
    }
    closeMenu({ closeInstantly = false, skipFocus = false } = {}) {
        // Only continue if there is a menu able to be closed.
        if (!this.menu || !this.isToggleable || !this.isOpen)
            return;
        // Update the menu visibility state.
        this.isOpen = false;
        // Update the button element.
        this.button.setAttribute('aria-expanded', 'false');
        // Stop listening for outside clicks.
        document.removeEventListener('click', this.closeOnOutsideClickBound);
        // Get the transition function.
        const transition = closeInstantly
            ? Menu.transitionFunctions.instant.close
            : this.transition.close;
        // Run the transition function.
        transition(this.menu, () => { this.closeChildMenus(); });
        doubleRequestAnimationFrame(() => {
            //
            if (this.hasMenuButton || this.parent.isRoot) {
                this.button.tabIndex = 0;
            }
            // Send focus to the button for the menu.
            if (!closeInstantly && !skipFocus) {
                this.button.focus();
            }
        });
    }
    getTransition(transitions, depth) {
        // Get the transition object to fallback to.
        const defaultTransition = Menu.transitionFunctions.instant;
        // If the transitions array is invalid, fallback to the default.
        if (!transitions || !Array.isArray(transitions) || !transitions.length) {
            return defaultTransition;
        }
        // If the transition isn't specified for the menu at this depth, look up the tree.
        if (!transitions[depth]) {
            return depth === 0
                ? defaultTransition
                : this.getTransition(transitions, depth - 1);
        }
        // Check if the name of a built-in transition was specified.
        if (typeof transitions[depth] === 'string') {
            const transitionName = transitions[depth];
            return Object.keys(Menu.transitionFunctions).includes(transitionName)
                ? Menu.transitionFunctions[transitionName]
                : defaultTransition;
        }
        // Check if a custom transition object was provided.
        if (typeof transitions[depth] === 'object') {
            const transition = transitions[depth];
            return typeof transition.open === 'function' && typeof transition.close === 'function'
                ? transition
                : defaultTransition;
        }
        // Fallback to the default.
        return defaultTransition;
    }
    closeSiblingMenus() {
        if (!this.parent)
            return;
        this.parent.items.forEach((item) => {
            // Only continue if this item is a sibling and has a menu.
            if (item.menu === this || !item.menu)
                return;
            // Close the menu.
            item.menu.closeMenu({ skipFocus: true });
        });
    }
    closeChildMenus() {
        this.items.forEach((item) => {
            // Only continue if this item has a menu.
            if (!item.menu)
                return;
            // Close the the menu.
            item.menu.closeMenu({ closeInstantly: true, skipFocus: true });
        });
    }
    closeAllMenus() {
        if (this.isRoot) {
            if (this.isToggleable) {
                this.closeMenu({ skipFocus: true });
            }
            return;
        }
        if (this.parent.isRoot && !this.parent.isToggleable) {
            this.closeMenu({ skipFocus: true });
            return;
        }
        this.parent.closeAllMenus();
    }
    keydownHandler(event) {
        // Determine the key that was pressed and the index of the button it was pressed on.
        const key = event.key;
        const target = event.target;
        const index = Number(target.dataset.index);
        if (key === 'Escape') {
            this.closeMenu();
        }
        else if (key === 'Tab') {
            this.closeAllMenus();
        }
        else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            this.focusPreviousItem(index);
        }
        else if (key === 'ArrowRight' || key === 'ArrowDown') {
            this.focusNextItem(index);
        }
        else if (key === 'Home' || key === 'PageUp') {
            this.focusFirstItem();
        }
        else if (key === 'End' || key === 'PageDown') {
            this.focusLastItem();
        }
        else if (Menu.isPrintableCharacter(key)) {
            this.focusNextCharacterMatch(index, key);
        }
    }
    closeOnOutsideClick(event) {
        const target = event.target;
        // Only continue if the click target is not a descendent of the menu or button.
        if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.button.id}`))
            return;
        this.closeAllMenus();
    }
    focusPreviousItem(currentIndex) {
        this.focusItem(currentIndex === 0 ? this.items.length - 1 : currentIndex - 1);
    }
    focusNextItem(currentIndex) {
        this.focusItem(currentIndex === this.items.length - 1 ? 0 : currentIndex + 1);
    }
    focusFirstItem() {
        this.focusItem(0);
    }
    focusLastItem() {
        this.focusItem(this.items.length - 1);
    }
    focusItem(index) {
        const button = this.items[index].button;
        // Employ roving tab index for the root menu.
        if (this.isRoot) {
            this.resetTabIndeces();
            button.tabIndex = 0;
        }
        button.focus();
    }
    resetTabIndeces() {
        this.items.forEach((item) => {
            item.button.tabIndex = -1;
        });
    }
    focusNextCharacterMatch(currentIndex, character) {
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
    getNextCharacterMatch(character, startIndex, endIndex) {
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
    static getMenuItems(menu) {
        let items = Array.from(menu.querySelectorAll('.item'));
        // Keep only the child items, filtering out further descedents.
        items = items.filter((item) => item.closest('.menu') === menu);
        return items;
    }
    static getItemButton(item) {
        return item.querySelector('.button');
    }
    static getItemMenu(item) {
        return item.querySelector('.menu');
    }
    static generateUniqueID() {
        return `m${Math.random().toString(36).substr(2, 9)}`;
    }
    static isPrintableCharacter(string) {
        return string.length === 1 && string.match(/\S/) !== null;
    }
    static getFirstCharacter(element) {
        return element.textContent.substring(0, 1);
    }
    static getItemTabIndex(index, isInRootMenu) {
        // Children menu items are only ever focusable programmatically.
        if (!isInRootMenu)
            return -1;
        // Root menu items have a dynamic tab index, but initially only the first item is focusable.
        return index === 0 ? 0 : -1;
    }
}
/** The transition functions for opening and closing menus. */
Menu.transitionFunctions = {
    instant: {
        open(menu, callback) {
            menu.style.display = 'block';
            callback();
        },
        close(menu, callback) {
            menu.style.display = 'none';
            callback();
        },
    },
    fade: {
        open(menu, callback) {
            menu.style.opacity = '0';
            menu.style.transition = 'opacity 1000ms ease';
            menu.style.display = 'block';
            menu.addEventListener('transitionend', () => {
                callback();
            }, { once: true });
            doubleRequestAnimationFrame(() => { menu.style.opacity = '1'; });
        },
        close(menu, callback) {
            menu.style.opacity = '1';
            menu.style.transition = 'opacity 1000ms ease';
            menu.addEventListener('transitionend', () => {
                menu.style.display = 'none';
                callback();
            }, { once: true });
            doubleRequestAnimationFrame(() => { menu.style.opacity = '0'; });
        },
    },
    slide: {
        open(menu, callback) {
            menu.style.overflow = 'hidden';
            menu.style.display = 'block';
            const height = menu.offsetHeight;
            menu.style.maxHeight = '0';
            menu.style.transition = 'max-height 1000ms ease-out';
            menu.addEventListener('transitionend', () => {
                menu.style.overflow = 'visible';
                menu.style.transition = 'none';
                menu.style.maxHeight = 'none';
                callback();
            }, { once: true });
            doubleRequestAnimationFrame(() => { menu.style.maxHeight = `${height}px`; });
        },
        close(menu, callback) {
            menu.style.overflow = 'hidden';
            menu.style.display = 'block';
            const height = menu.offsetHeight;
            menu.style.maxHeight = `${height}px`;
            menu.style.transition = 'max-height 1000ms ease-out';
            menu.addEventListener('transitionend', () => {
                menu.style.display = 'none';
                menu.style.overflow = 'visible';
                menu.style.transition = 'none';
                menu.style.maxHeight = 'none';
                callback();
            }, { once: true });
            doubleRequestAnimationFrame(() => { menu.style.maxHeight = '0'; });
        },
    },
};
