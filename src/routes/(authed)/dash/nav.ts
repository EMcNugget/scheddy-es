import type { Component } from "svelte";
export interface NestedMenuItem {
	url: string;
	title: string;
	icon: Component;
	visible: boolean;
	isActive?: boolean;
	children?: NestedMenuItem[];
}
