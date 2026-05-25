from django.urls import path
from . import views

urlpatterns = [
    # -- GENERAL ----------------------------------------------
    path("", views.home, name="home"),
    path("game/", views.game, name="game"),
    path("game.html", views.game, name="game_html"),
    path("login/", views.login, name="login"),
    path("choose-path/", views.choose_path, name="choose_path"),
    path("about/", views.about, name="about"),
    path("about.html", views.about, name="about_html"),

    path("choose-role/", views.choose_role, name="choose-role"),
    path("choose_staffrole.html", views.choose_role, name="choose-role_html"),
    

    # -- DASHBOARD (student) ----------------------------------------------
    path("dashboard/", views.dashboard, name="dashboard"),
    path("dashboard.html", views.dashboard, name="dashboard_html"),
    path("profile/update/", views.update_profile, name="update_profile"),

    # -- BAO (student) ----------------------------------------------
    path("bao/", views.bao, name="bao"),
    path("bao.html", views.bao, name="bao_html"),
    path("bao/place-order/", views.bao_place_order, name="bao_place_order"),

    # -- BAO (staff) ----------------------------------------------
    path("bao/staff/", views.bao_staff, name="bao_staff"),
    path("bao/update-status/", views.bao_update_order_status, name="bao_update_order_status"),
    path("bao/update-stock/", views.bao_update_stock, name="bao_update_stock"),
    path("bao/save-item/", views.bao_save_item, name="bao_save_item"),
    path("bao/delete-item/", views.bao_delete_item, name="bao_delete_item"),
    path("bao/student-center/", views.staff_sc_bao, name="staff_sc_bao"),

    # -- CLINIC (student) ----------------------------------------------
    path("clinic/", views.clinic, name="clinic"),
    path("clinic.html", views.clinic, name="clinic_html"),
    path("clinic/slots/", views.clinic_slots, name="clinic_slots"),
    path("clinic/book/", views.clinic_book, name="clinic_book"),
    path("clinic/cancel/", views.clinic_cancel, name="clinic_cancel"),

    # -- CLINIC (staff) ----------------------------------------------
    path("clinic/staff/", views.clinic_staff, name="clinic_staff"),
    path("clinic/update-status/",  views.clinic_update_status, name="clinic_update_status"),
    path("clinic/student-center/",  views.staff_sc_clinic, name="staff_sc_clinic"),

    # -- STUDENT CENTER (student) ----------------------------------------------
    path("student-center/", views.student_center, name="student_center"),
    path("student_center.html", views.student_center, name="student_center_html"),
    path("student-center/listings/", views.sc_listings, name="sc_listings"),
    path("student-center/my-listings/", views.sc_my_listings, name="sc_my_listings"),
    path("student-center/post-listing/", views.sc_post_listing, name="sc_post_listing"),
    path("student-center/reserve/", views.sc_reserve, name="sc_reserve"),
    path("student-center/mark-sold/", views.sc_mark_sold, name="sc_mark_sold"),
    path("student-center/delete-listing/", views.sc_delete_listing, name="sc_delete_listing"),
    path("student-center/apply-moderator/",views.sc_apply_moderator, name="sc_apply_moderator"),
    path("student-center/reserve/", views.sc_reserve, name="sc_reserve"),
    path("student-center/contact/", views.sc_contact_seller, name="sc_contact_seller"),
    path("student-center/get-user-card/", views.sc_get_user_card, name="sc_get_user_card"), # NEW
    path("student-center/respond-reserve/", views.sc_respond_reserve, name="sc_respond_reserve"), # NEW
    path("student-center/mark-sold/", views.sc_mark_sold, name="sc_mark_sold"),

    # -- STUDENT CENTER (staff or student mod) ----------------------------------------------
    path("student-center/staff/", views.sc_staff, name="sc_staff"),
    path("student-center/review-application/", views.sc_review_application, name="sc_review_application"),
    path("student-center/revoke-moderator/", views.sc_revoke_moderator, name="sc_revoke_moderator"),
    path("student-center/staff-remove-listing/", views.sc_staff_remove_listing,name="sc_staff_remove_listing"),
    
    # -- NOTIFS --------------------------------------------------------------------------------------
    path("notifications/", views.notifications_fetch, name="notifications_fetch"),
    path("notifications/mark-read/", views.notifications_mark_read, name="notifications_mark_read"),
]