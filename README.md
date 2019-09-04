# Accessible Menu

> A JavaScript class which attaches navigation menu behavior to markup.

## Features

- **Fully accessible** - Incorporates all essential practices for accessibilty.
- **Style-agnostic** - Makes no assumptions about the CSS.
- **Highly flexible** - Allows for infinitely-nested menus.

## Terminology

- **Menu** - An element which contains items.
- **Item** - An element which contains a label, and optionally a menu.
- **Label** - An element which displays text and is actionable (e.g. `<a>` or `<button>`).

## Structure

- A **menu** must contain one or more **items**.
- An **item** must contain one and only one **label**.
- An **item** must contain zero or one **menus**.

This pattern is infinitely nestable. See the example menu structure below:

```
menu
├───item
│   └───label
├───item
│   ├───label
│   └───menu
│       ├───item
│       │   └───label
│       └───item
│           └───label
├───item
│   ├───label
│   └───menu
│       ├───item
│       │   └───label
│       ├───item
│       │   ├───label
│       │   └───menu
│       │       ├───item
│       │       │   └───label
│       │       ├───item
│       │       │   └───label
│       │       └───item
│       │           └───label
│       └───item
│           └───label
├───item
│   └───label
└───item
    └───label
```

## Accessibility

### Attributes

#### Menu

- `aria-label` is set to `Menu` (if no value is found).
- `id` is set to a randomly-generated string (if no value is found).
- `role` is set to `menu` (or `menubar` if this menu is the root menu).

#### Item

- No attribute modifications.

#### Label

- `id` is set to a randomly-generated string.
- `tabindex` is set to `-1` (or `0` if it is the first label in the root menu).
- `tabindex` is dynamically updated as part of a `roving tabindex` pattern.
- `role` is set to `menuitem`.
- If the item has a menu...
	- `aria-haspopup` is set to `true`.
	- `aria-controls` is set to its menu's `id`.
	- `aria-expanded` is set to `false`.
	- `aria-expanded` is dynamically updated as part of a `expand/collapse` pattern.

### Mouse Control

- Clicking a label for an item without a menu will gain no special behavior.
- Clicking a label for an item with a menu will toggle the visibility of that menu.
- Clicking outside of an open menu (except the root menu) will cause the menu to close, along with any open child menus.

### Keyboard Control

When focus is on a label:

- **Space**
	- If the item has a menu...
		- If the menu is closed...
			- Opens the menu and moves focus to the first label in the menu.
		- If the menu is open...
			- Closes the menu and any open child menus.
- **Enter**
	- If the item has a menu...
		- If the menu is closed...
			- Opens the menu and moves focus to the first label in the menu.
		- If the menu is open...
			- Closes the menu and any open child menus.
- **Escape**
	- If the item is in a non-root menu...
		- If the menu is open...
			- Closes the menu and any open child menus. Moves focus to the label which opened it.
- **Left Arrow** - Moves focus to the previous label in the menu. If focus is on the first label, moves focus to the last label.
- **Right Arrow** - Moves focus to the next label in the menu. If focus is on the last label, moves focus to the first label.
- **Up Arrow** - Moves focus to the previous label in the menu. If focus is on the first label, moves focus to the last label.
- **Down Arrow** - Moves focus to the next label in the menu. If focus is on the last label, moves focus to the first label.
- **Home** - Moves focus to the first label in the menu.
- **End** - Moves focus to the last label in the menu.
- **Page Up** - Moves focus to the first label in the menu.
- **Page Down** - Moves focus to the last label in the menu.
- **Character** - Moves focus to next label in the menu that starts with the typed character (wrapping around to the beginning, if necessary). If none of the labels start with the typed character, focus does not move.

## Usage

The menu markup should be written such that **menu** elements have the class `.menu`, **item** elements have the class `.item`, and **label** elements have the class `.item`.

To attach behavior to a menu, simply instantiate a new `Menu` with the root menu as the only argument. The `Menu` class will recursively construct instances for any child menus.

``` html
<div class="menu">
	<div class="item">
		<a class="label" href="#">Lorem Ipsum</a>
	</div>

	<div class="item">
		<button class="label">Dolor Sit</button>

		<div class="menu">
			<div class="item">
				<a class="label" href="#">Amet Consectetur</a>
			</div>

			<div class="item">
				<a class="label" href="#">Adipiscing Elit</a>
			</div>
		</div>
	</div>
</div>
```

``` js
new Menu(document.querySelector('.menu'));
```

[See full examples &raquo;](./examples]
