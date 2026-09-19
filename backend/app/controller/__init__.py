from app.controller.chat_controller import router as chat_router
from app.controller.course_controller import router as course_router
from app.controller.section_controller import router as section_router
from app.controller.history_controller import router as history_router
from app.controller.material_controller import router as material_router
from app.controller.quiz_controller import router as quiz_router

__all__ = ["chat_router", "course_router", "section_router", "history_router", "material_router", "quiz_router"]
