from app.controller.course_controller import router as course_router
from app.controller.material_controller import router as material_router
from app.controller.quiz_controller import router as quiz_router
from app.controller.textbook_controller import router as textbook_router

__all__ = ["course_router", "material_router", "quiz_router", "textbook_router"]
