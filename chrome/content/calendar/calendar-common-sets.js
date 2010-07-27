function deleteCalendar() {
    var calendars = getCalendarManager().getCalendars({});
    if (calendars.length <= 1) {
        // If this is the last calendar, don't delete it.
        return;
    }

    var bundle = document.getElementById("bundle_integrator_calendar");
    var aCalendar = getSelectedCalendar();
    var title =  bundle.getString("deleteCalendarTitle");
    var msg = bundle.getString("deleteCalendarMessage");
   
    if (aCalendar.type == "caldav") {
      var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;
      var entry = aclMgr.calendarEntry(aCalendar.uri);
      
      if (!entry.userIsOwner()) {
	title = calGetString("calendar", "unsubscribeCalendarTitle");
	msg = calGetString("calendar", "unsubscribeCalendarMessage", [aCalendar.name]);
      } 
    }

    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
    var ok = promptService.confirm(window, title, msg, {});

    if (ok) {
        var calMgr = getCalendarManager();
        calMgr.unregisterCalendar(aCalendar);
        calMgr.deleteCalendar(aCalendar);
    }
}
