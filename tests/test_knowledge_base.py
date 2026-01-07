#!/usr/bin/env python3
"""
Knowledge Base Tests
====================

Tests for the knowledge base system that allows agents to learn from
previous implementations and share patterns.

Run with: pytest tests/test_knowledge_base.py -v
"""

from pathlib import Path

from autocoder.core.knowledge_base import KnowledgeBase


def test_knowledge_base_store_and_retrieve():
    """Test storing and retrieving patterns from knowledge base."""
    # Note: KnowledgeBase uses global ~/.autocoder/knowledge.db for cross-project learning
    kb = KnowledgeBase()

    # Store a pattern
    feature = {
        "category": "test_authentication",
        "name": "test login form",
        "description": "Create a login form with email validation"
    }

    implementation = {
        "approach": "React component with Formik",
        "files_changed": ["src/components/LoginForm.tsx"],
        "model_used": "claude-opus-4-5"
    }

    kb.store_pattern(
        feature=feature,
        implementation=implementation,
        success=True,
        attempts=1,
        lessons_learned="Use Formik for forms"
    )

    # Get summary (basic retrieval)
    summary = kb.get_summary()
    assert summary["total_patterns"] > 0, "Should have at least our test pattern"
    assert "test_authentication" in summary["by_category"], "Should have our test category"

    # Get similar features (method exists and returns list)
    similar = kb.get_similar_features({
        "category": "test_authentication",
        "name": "test login page",
        "description": "Create login page with password reset"
    })
    assert isinstance(similar, list), "Should return a list"

    print("✅ Knowledge base store and retrieve works")


def test_knowledge_base_model_learning():
    """Test that knowledge base learns which models work best."""
    kb = KnowledgeBase()

    # Store successful implementations with different models
    for i in range(3):
        feature = {
            "category": "test_model_learning",
            "name": f"auth feature {i}",
            "description": "Authentication feature"
        }

        implementation = {
            "approach": "JWT auth",
            "files_changed": ["src/auth.ts"],
            "model_used": "claude-opus-4-5"
        }

        kb.store_pattern(
            feature=feature,
            implementation=implementation,
            success=True,
            attempts=1,
            lessons_learned="Opus works best for auth"
        )

    # Get recommended model
    model = kb.get_best_model("test_model_learning")
    assert model == "claude-opus-4-5", "Should recommend Opus for test category"
    print("✅ Knowledge base model learning works")


def test_knowledge_base_reference_generation():
    """Test generating reference prompts from past work."""
    kb = KnowledgeBase()

    # Store a successful pattern
    feature = {
        "category": "test_reference",
        "name": "responsive navbar",
        "description": "Create responsive navigation bar"
    }

    implementation = {
        "approach": "Flexbox with media queries",
        "files_changed": ["src/components/Navbar.tsx", "src/styles/navbar.css"],
        "model_used": "claude-sonnet-4-5"
    }

    kb.store_pattern(
        feature=feature,
        implementation=implementation,
        success=True,
        attempts=1,
        lessons_learned="Mobile-first approach works best"
    )

    # Generate reference prompt (method exists and returns string)
    reference = kb.get_reference_prompt({
        "category": "test_reference",
        "name": "responsive header",
        "description": "Create responsive header"
    })

    assert isinstance(reference, str), "Should return a string"
    assert len(reference) > 0, "Should not be empty"
    print("✅ Knowledge base reference generation works")


def test_knowledge_base_categories():
    """Test getting statistics by category."""
    kb = KnowledgeBase()

    # Store patterns in different categories
    categories = ["test_cat1", "test_cat2", "test_cat3", "test_cat2"]
    for i, cat in enumerate(categories):
        feature = {
            "category": cat,
            "name": f"feature {i}",
            "description": f"{cat} feature"
        }

        implementation = {
            "approach": "Test approach",
            "files_changed": ["file.ts"],
            "model_used": "claude-opus-4-5"
        }

        kb.store_pattern(
            feature=feature,
            implementation=implementation,
            success=True,
            attempts=1,
            lessons_learned=f"Lesson for {cat}"
        )

    # Get summary
    summary = kb.get_summary()
    assert summary["total_patterns"] > 0, "Should have patterns"
    assert "test_cat2" in summary["by_category"], "Should have test_cat2 category"
    assert summary["by_category"]["test_cat2"] >= 2, "Should have at least 2 test_cat2 patterns"
    print("✅ Knowledge base summary works")


if __name__ == "__main__":
    print("Running Knowledge Base Tests...\n")

    test_knowledge_base_store_and_retrieve()
    test_knowledge_base_model_learning()
    test_knowledge_base_reference_generation()
    test_knowledge_base_categories()

    print("\n" + "=" * 70)
    print("ALL KNOWLEDGE BASE TESTS PASSED ✅")
    print("=" * 70)
