from __future__ import annotations

import pytest

from autocoder.server.services.terminal_manager import (
    cleanup_all_terminals,
    create_terminal,
    delete_terminal,
    get_terminal_info,
    list_terminals,
    rename_terminal,
)


@pytest.mark.asyncio
async def test_terminal_metadata_crud() -> None:
    project = "test-project-term"

    assert list_terminals(project) == []

    t1 = create_terminal(project)
    assert t1.id
    assert t1.name.startswith("Terminal ")

    terms = list_terminals(project)
    assert len(terms) == 1

    assert rename_terminal(project, t1.id, "My Term") is True
    info = get_terminal_info(project, t1.id)
    assert info is not None
    assert info.name == "My Term"

    assert delete_terminal(project, t1.id) is True
    assert get_terminal_info(project, t1.id) is None

    await cleanup_all_terminals()

