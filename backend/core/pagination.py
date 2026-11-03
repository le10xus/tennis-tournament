from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Пагинация по умолчанию с поддержкой ?page_size= (фронт просит 200–500)."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500
