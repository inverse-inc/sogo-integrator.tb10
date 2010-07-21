/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (let i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("calendar-overlay.js: failed to include '" + files[i] + "'\n"
					 + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/calendar/folder-handler.js",
					 "chrome://sogo-integrator/content/general/creation-utils.js",
					 "chrome://sogo-integrator/content/general/subscription-utils.js"]);

function openCalendarCreationDialog() {
	openDialog("chrome://sogo-integrator/content/calendar/creation-dialog.xul",
						 "calendarSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function openCalendarSubcriptionDialog() {
	openDialog("chrome://sogo-integrator/content/general/subscription-dialog.xul",
						 "calendarSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function manageCalendarACL() {
	let calendar = getSelectedCalendar();
	let aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
		.getService(Components.interfaces.nsISupports)
		.wrappedJSObject;
	let entry = aclMgr.calendarEntry(calendar.uri);
	
	if (entry.userIsOwner()) {
		let url = calendar.uri.spec;
		openDialog("chrome://sogo-integrator/content/general/acl-dialog.xul",
							 "calendarACL",
							 "dialog,titlebar,modal",
							 {url: url,
									 rolesDialogURL: "chrome://sogo-integrator/content/calendar/roles-dialog.xul"});
	} else {
		aclMgr.refresh(calendar.uri);
	}
}

function _confirmDelete(name) {
	let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);

	let bundle = document.getElementById("bundle_integrator_calendar");
 
	return promptService.confirm(window,
															 bundle.getString("deleteCalendarTitle"),
															 bundle.getString("deleteCalendarMessage"),
															 {});
}

function openDeletePersonalDirectoryForbiddenDialog() {
	let bundle = document.getElementById("bundle_integrator_calendar");
	alert(bundle.getString("deletePersonalCalendarError"));
}

function openCalendarUnsubcriptionDialog() {
	let calendar = getSelectedCalendar();

	let url = calendar.uri.spec;
	let baseURL = sogoBaseURL();
	if (url.indexOf(baseURL) == 0) {
		let parts = url.split("/");
		let offset = 1;
		if (url[url.length-1] == '/')
			offset++;
		let part = parts[parts.length-offset];
		let handler = new CalendarHandler();
		let mgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
			.getService(Components.interfaces.nsISupports)
			.wrappedJSObject;
		let entry = mgr.calendarEntry(calendar.uri);
		if (entry.userIsOwner()) {
			dump("url = " + url + " baseURL = " + baseURL + "\n");
			let urlParts = url.split("/");
			
			// We prevent the removal the "personal" calendar
			if (urlParts[urlParts.length-2] == "personal") {
				openDeletePersonalDirectoryForbiddenDialog();
			}
			else if (_confirmDelete(calendar.name)) {
				deleteFolder(url, handler);
			}
		}
		else
			unsubscribeFromFolder(url, handler);
	}
	else if (_confirmDelete(calendar.name)) {
		let calMgr = getCalendarManager();
		calMgr.unregisterCalendar(calendar);
		calMgr.deleteCalendar(calendar);

		let url = calendar.uri.spec;
		if (url[url.length - 1] != '/')
			url = url.concat('/');
	}
}

function subscriptionDialogType() {
	return "calendar";
}

function subscriptionGetHandler() {
	return new CalendarHandler();
}

function toggleShowAllCalendars() {
	let tree = document.getElementById("calendar-list-tree-widget");
	if (tree) {
		let composite = tree.compositeCalendar;

		for (let i = 0; i < tree.rowCount; i++) {
			let calendar = tree.getCalendar(i);
			composite.addCalendar(calendar);
			tree.treebox.invalidateRow(i);
		}
	}
}

function toggleShowOnlyCalendar() {
	let tree = document.getElementById("calendar-list-tree-widget");
	if (tree) {
		let selectedCal = getSelectedCalendar();
		let calIndex = 0;
		let composite = tree.compositeCalendar;
		for (let i = 0; i < tree.rowCount; i++) {
			let calendar = tree.getCalendar(i);
			if (calendar.id == selectedCal.id) {
				calIndex = i;
			} else {
				composite.removeCalendar(calendar);
				tree.treebox.invalidateRow(i);
			}
		}

		composite.addCalendar(selectedCal);
		tree.treebox.invalidateRow(calIndex);
	}
}

function toggleShowOnlyCalendarByCal(cal) {
	let tree = document.getElementById("calendar-list-tree-widget");
	if (tree) {
		let composite = tree.compositeCalendar;
		for (let i = 0; i < tree.rowCount; i++) {
			let calendar = tree.getCalendar(i);
			if (calendar.uri != cal.uri) {
				composite.removeCalendar(calendar);
			}
		}

		composite.addCalendar(cal);
		for (let i = 0; i < tree.rowCount; i++) {
			tree.treebox.invalidateRow(i);
		}
	}
}

window.creationGetHandler = subscriptionGetHandler;

window.addEventListener("load", SIOnCalendarOverlayLoad, false);

function SIOnCalendarOverlayLoad() {
	let widget = document.getElementById("calendar-list-tree-widget");
	widget.addEventListener("mousedown", SIOnListMouseDown, true);
}

function SIOnListMouseDown(event) {
	if (event.type == "mousedown" && event.button == 0 && event.shiftKey) {
		let col = {};
		let calendar = this.getCalendarFromEvent(event, col);
		if (calendar && col.value && col.value.index == 0) {
			toggleShowOnlyCalendarByCal(calendar);
			event.stopPropagation();
		}
	}
}
