from django.contrib import admin
from .models import Student, Staff, BaoItem, BaoOrder, BaoOrderItem, ClinicAppointment, SCListing, SCModeratorApplication, SCModerator, Notification

admin.site.site_header = "School Navigation Admin"
admin.site.site_title = "Navigation Control Panel"
admin.site.index_title = "Welcome to the Navigation Dashboard"

# Register your models here.
admin.site.register(Student)
admin.site.register(Staff)
admin.site.register(BaoItem)
admin.site.register(BaoOrder)
admin.site.register(BaoOrderItem)
admin.site.register(ClinicAppointment)
admin.site.register(SCListing)
admin.site.register(SCModeratorApplication)
admin.site.register(SCModerator)
admin.site.register(Notification)
