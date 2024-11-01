// src/components/TypingInput.js
import React, { useContext, useEffect, useRef, useState } from 'react';
import { TypingContext } from '../contexts/TypingContext';
import styled, { keyframes } from 'styled-components';
import { FaLevelDownAlt, FaWindowMaximize, FaWindowMinimize } from 'react-icons/fa';

// Blinking cursor animation
const blink = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
`;

// Styled Components
const Container = styled.div.attrs(() => ({
  tabIndex: 0, // Make the container focusable
}))`
  position: relative;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  background-color: #282c34;
  color: #f7f7f7;
  overflow: auto;
  text-align: left; /* Align text to the left */
  outline: none; /* Remove default outline */
  // border-radius: 8px;
  min-height: 200px;

  // &:focus {
  //   outline: 2px solid #61dafb; /* Custom outline on focus */
  // }

  @media (max-width: 600px) {
    padding: 15px;
    font-size: 0.9em;
  }
`;

const Prompt = styled.div`
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 3.5em;
  line-height: 1.5;

  @media (max-width: 600px) {
    font-size: 2.5em;
  }
`;

const TypedText = styled.span`
  color: #61dafb; /* Highlight color for correctly typed text */
`;

const RemainingText = styled.span`
  color: rgba(247, 247, 247, 0.5); /* Lighter font color for remaining text */
`;

const ErrorText = styled.span`
  color: red; /* Red color for mistyped characters */
`;

const Cursor = styled.span`
  display: inline-block;
  width: 0.1rem;
  background-color: #61dafb; /* Highlight color for cursor */
  animation: ${blink} 1s step-start infinite;
  margin-left: -0.1rem;
  height: 4rem;
  vertical-align: top;
  margin-top: 0.5rem;

  @media (max-width: 600px) {
    height: 2rem;
  }
`;

const StatsContainer = styled.div`
  margin-top: 20px;
  font-size: 1em;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  color: #636363;

  @media (max-width: 600px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const StatItem = styled.div`
  /* flex: 1 1 150px; */ /* Commented out as per the user code */
  @media (max-width: 600px) {
    font-size: 0.9em;
  }
`;

const FullscreenButton = styled.button`
  position: absolute;
  opacity: .15;
  top: 20px;
  right: 20px;
  background-color: #61dafb;
  color: #282c34;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;

  &:hover {
    background-color: #21a1f1;
  }

  @media (max-width: 600px) {
    top: 15px;
    right: 15px;
    padding: 6px 10px;
    font-size: 0.8em;
  }
`;

// Helper function to calculate statistics
const calculateStats = (userInput, prompt, startTime) => {
  const endTime = Date.now();
  const timeElapsed = endTime - startTime; // milliseconds
  const timeElapsedInSeconds = timeElapsed / 1000; // seconds
  const timeElapsedInMinutes = timeElapsed / 60000; // minutes

  const wordsTyped = userInput.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charsTyped = userInput.length;

  const wpm = timeElapsedInMinutes > 0 ? Math.round(wordsTyped / timeElapsedInMinutes) : 0;
  const cpm = timeElapsedInMinutes > 0 ? Math.round(charsTyped / timeElapsedInMinutes) : 0;

  // Calculate typos as the number of incorrect characters
  let typos = 0;
  for (let i = 0; i < userInput.length; i++) {
    if (userInput[i] !== prompt[i]) {
      typos += 1;
    }
  }

  const correctChars = userInput.length - typos;
  const accuracy = prompt.length > 0 ? Math.round((correctChars / prompt.length) * 100) : 100;

  return { 
    wpm, 
    cpm, 
    accuracy, 
    timeElapsed: timeElapsedInSeconds, // seconds
    typos 
  };
};

const TypingInput = () => {
  const { state, dispatch } = useContext(TypingContext);
  const { currentPrompt, userInput, startTime, status, stats, completedPrompts } = state;
  const [fullScreen, setFullScreen] = useState(false);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);

  // Handle full-screen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setFullScreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setFullScreen(false);
      });
    }
  };

  // Handle input
  const handleKeyDown = (e) => {
    if (status === 'completed' || status === 'interrupted') return;

    if (e.ctrlKey && e.key === 'c') {
      dispatch({ type: 'INTERRUPT' });
      return;
    }

    if (status === 'idle') {
      dispatch({ type: 'START' });
    }

    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
      e.preventDefault();
      let newInput = userInput;

      if (e.key === 'Backspace') {
        newInput = userInput.slice(0, -1);
      } else if (e.key === 'Enter') {
        newInput += '\n';
      } else {
        // Prevent input from exceeding the prompt length
        if (userInput.length < currentPrompt.text.length) {
          newInput += e.key;
        }
      }

      dispatch({ type: 'UPDATE_INPUT', payload: newInput });

      // Update stats
      if (startTime) {
        const newStats = calculateStats(newInput, currentPrompt.text, startTime);
        dispatch({ type: 'UPDATE_STATS', payload: newStats });
      }

      // Check completion
      if (newInput === currentPrompt.text) {
        dispatch({ type: 'STOP' });
        dispatch({ type: 'ADD_COMPLETED_PROMPT', payload: currentPrompt.id });
      }
    }
  };

  // Attach keydown listener to the Container
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (currentContainer) {
      currentContainer.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [userInput, status, startTime, currentPrompt]);

  // Handle statistics timer
  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(() => {
        const newStats = calculateStats(userInput, currentPrompt.text, startTime);
        dispatch({ type: 'UPDATE_STATS', payload: newStats });
      }, 100); // Update every 100 milliseconds for performance
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [status, userInput, currentPrompt, startTime, dispatch]);

  // Reset input and stats when currentPrompt changes
  useEffect(() => {
    dispatch({ type: 'RESET' });
    containerRef.current.focus(); // Auto-focus on new prompt
  }, [currentPrompt, dispatch]);

  // Function to render prompt with colored text and cursor at the correct position
  const renderPrompt = () => {
    const characters = currentPrompt.text.split('');
    const inputLength = userInput.length;
    const inputChars = userInput.split('');

    const elements = [];

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      let displayChar = char === '\n' ? (<>
        <FaLevelDownAlt style={{
          opacity: '0.25',
          top: '0.25rem',
          position: 'relative',
          rotate: '90deg',
          marginRight: '0.5rem',
          marginLeft: '0.25rem'
        }} key={`icon-${i}`} />
        <br />
      </>) : char;

      if (i < inputLength) {
        // Correctly typed character
        if (inputChars[i] === char) {
          elements.push(<TypedText key={i}>{displayChar}</TypedText>);
        } else {
          // Mistyped character
          elements.push(<ErrorText key={i}>{displayChar}</ErrorText>);
        }
      } else {
        // Remaining characters
        elements.push(<RemainingText key={i}>{displayChar}</RemainingText>);
      }

      // Insert cursor after the last typed character
      if (i === inputLength - 1) {
        if (status !== 'completed' && status !== 'interrupted') {
          elements.push(<Cursor key="cursor" />);
        }
      }
    }

    // If user has typed all characters, append cursor at the end if not completed
    if (inputLength === characters.length && (status === 'idle' || status === 'running')) {
      elements.push(<Cursor key="cursor" />);
    }

    // If user hasn't typed anything, place cursor at the start
    if (inputLength === 0 && (status === 'idle' || status === 'running')) {
      elements.unshift(<Cursor key="cursor" />);
    }

    return elements;
  };

  return (
    <Container
      className="Container"
      ref={containerRef}
      onClick={() => containerRef.current.focus()} // Focus on click
      aria-label="Typing Input Area"
    >
      {/* <FullscreenButton onClick={toggleFullScreen} aria-label="Toggle Fullscreen">
        {fullScreen ? <FaWindowMinimize /> : <FaWindowMaximize /> }
      </FullscreenButton> */}
      <Prompt className="Prompt">
        {renderPrompt()}
      </Prompt>
      <StatsContainer className="StatsContainer">
        <StatItem>Time: {stats.timeElapsed.toFixed(3)} sec</StatItem>
        <StatItem>WPM: {stats.wpm}</StatItem>
        <StatItem>CPM: {stats.cpm}</StatItem>
        <StatItem>Accuracy: {stats.accuracy}%</StatItem>
        <StatItem>Typos: {stats.typos}</StatItem>
        {(status === 'completed' || status === 'interrupted') && (
          <StatItem>Status: {status === 'completed' ? 'Completed' : 'Interrupted'}</StatItem>
        )}
      </StatsContainer>
    </Container>
  );
};

export default TypingInput;