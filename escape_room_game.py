import pygame
import time
import random

# Initialize pygame
pygame.init()

# Game settings
screen_width = 1200
screen_height = 800
screen = pygame.display.set_mode((screen_width, screen_height))
pygame.display.set_caption("Unconventional Escape Room")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)

# Fonts
font = pygame.font.SysFont('Arial', 30)
big_font = pygame.font.SysFont('Arial', 50)

# Load images and resize them
background_img = pygame.image.load('images/background.jpeg')
background_img = pygame.transform.scale(background_img, (screen_width, screen_height))  # Resize to screen size
chair_img = pygame.image.load('images/chair.jpeg')
chair_img = pygame.transform.scale(chair_img, (400, 400))  # Resize image
elevator_img = pygame.image.load('images/elevator.jpeg')
elevator_img = pygame.transform.scale(elevator_img, (400, 300))  # Resize image

# Time tracking
start_time = time.time()
time_limit = 180  # 3 minutes in seconds

# Function to draw text on screen
def draw_text(text, font, color, surface, x, y):
    textobj = font.render(text, True, color)
    textrect = textobj.get_rect()
    textrect.center = (x, y)
    surface.blit(textobj, textrect)

# Function to display timer
def display_timer():
    elapsed_time = int(time.time() - start_time)
    time_left = max(0, time_limit - elapsed_time)
    time_text = f"Time Left: {time_left // 60}:{time_left % 60:02d}"
    draw_text(time_text, font, BLACK, screen, screen_width - 150, 30)

# Function to create a colorful moving background
def draw_background():
    for y in range(screen_height):
        r = int((1 + (y / screen_height)) * 128 + 128 * (1 + (time.time() % 1)))
        g = int((1 + ((y + screen_height // 3) / screen_height)) * 128 + 128 * (1 + (time.time() % 1)))
        b = int((1 + ((y + 2 * screen_height // 3) / screen_height)) * 128 + 128 * (1 + (time.time() % 1)))
        pygame.draw.line(screen, (r % 256, g % 256, b % 256), (0, y), (screen_width, y))

# Mini-game: Number Guessing
def number_guessing_game():
    draw_background()
    draw_text("Guess the number between 1 and 10!", font, BLACK, screen, screen_width // 2, screen_height // 2 - 100)
    draw_text("You have 3 guesses", font, BLACK, screen, screen_width // 2, screen_height // 2 - 50)
    pygame.display.update()

    number_to_guess = random.randint(1, 10)
    guesses_left = 3
    guessed = False
    while guesses_left > 0 and not guessed:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key in [pygame.K_1, pygame.K_2, pygame.K_3, pygame.K_4, pygame.K_5, pygame.K_6, pygame.K_7, pygame.K_8, pygame.K_9, pygame.K_0]:
                    guess = int(pygame.key.name(event.key))
                    guesses_left -= 1
                    if guess == number_to_guess:
                        guessed = True
                        draw_text(f"Correct! The number was {number_to_guess}.", font, GREEN, screen, screen_width // 1, screen_height // 1)
                    elif guess < number_to_guess:
                        draw_text(f"Too low! {guesses_left} guesses left.", font, BLACK, screen, screen_width // 1.5, screen_height // 1.5)
                    else:
                        draw_text(f"Too high! {guesses_left} guesses left.", font, BLACK, screen, screen_width // 1.5, screen_height // 1.5)
                    pygame.display.update()

    if not guessed:
        draw_text("You lost the guessing game.", font, RED, screen, screen_width // 2, screen_height // 2 + 50)
        pygame.display.update()
        pygame.time.delay(2000)
        return False

    pygame.time.delay(2000)
    return True

# Mini-game: Click the Random Dot
def click_dot_game():
    draw_background()
    dots_clicked = 0
    start_time_game = time.time()
    target_time = 6  # 6 seconds to click 5 dots
    dot_positions = []

    while dots_clicked < 5:
        if time.time() - start_time_game > target_time:
            draw_background()
            draw_text("You lost! Time's up.", font, RED, screen, screen_width // 2, screen_height // 2)
            pygame.display.update()
            pygame.time.delay(2000)
            return False

        # Randomly place new dot every 1 second
        if len(dot_positions) < 5:
            dot_x = random.randint(100, screen_width - 100)
            dot_y = random.randint(100, screen_height - 100)
            dot_positions.append((dot_x, dot_y))

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.MOUSEBUTTONDOWN:
                mouse_x, mouse_y = event.pos
                for dot in dot_positions:
                    if (mouse_x - dot[0])**2 + (mouse_y - dot[1])**2 <= 20**2:
                        dots_clicked += 1
                        dot_positions.remove(dot)
                        break

        # Draw all remaining dots
        draw_background()
        for dot in dot_positions:
            pygame.draw.circle(screen, RED, dot, 20)
        pygame.display.update()

    draw_background()
    draw_text(f"Good job! You clicked all the dots.", font, GREEN, screen, screen_width // 2, screen_height // 2)
    pygame.display.update()
    pygame.time.delay(2000)
    return True

# Chair puzzle
def chair_puzzle():
    draw_background()
    screen.blit(chair_img, (50, 50))
    draw_text("Solve the riddle: 'I am something that reflects, but never moves. What am I?'", font, BLACK, screen, screen_width // 2, screen_height - 100)
    draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 50)
    pygame.display.update()

    answer = ''
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if answer.lower() == 'mirror':
                        return True
                    else:
                        answer = ''
                elif event.key == pygame.K_BACKSPACE:
                    answer = answer[:-1]
                elif event.key == pygame.K_g:  # Give up
                    return False
                else:
                    answer += event.unicode

        draw_background()
        screen.blit(chair_img, (50, 50))
        draw_text("Solve the riddle: 'I am something that reflects, but never moves. What am I?'", font, BLACK, screen, screen_width // 2, screen_height - 100)
        draw_text("Your answer: " + answer, font, BLACK, screen, screen_width // 2, screen_height - 50)
        draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 20)
        pygame.display.update()

# Clock puzzle
def clock_puzzle():
    draw_background()
    screen.blit(chair_img, (50, 200))
    draw_text("Solve the riddle: 'I have hands but cannot clap. What am I?'", font, BLACK, screen, screen_width // 2, screen_height - 100)
    draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 50)
    pygame.display.update()

    answer = ''
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if answer.lower() == 'clock':
                        return True
                    else:
                        answer = ''
                elif event.key == pygame.K_BACKSPACE:
                    answer = answer[:-1]
                elif event.key == pygame.K_g:  # Give up
                    return False
                else:
                    answer += event.unicode

        draw_background()
        screen.blit(chair_img, (50, 200))
        draw_text("Solve the riddle: 'I have hands but cannot clap. What am I?'", font, BLACK, screen, screen_width // 2, screen_height - 100)
        draw_text("Your answer: " + answer, font, BLACK, screen, screen_width // 2, screen_height - 50)
        draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 20)
        pygame.display.update()

# Light switch puzzle
def light_switch_puzzle():
    draw_background()
    draw_text("Puzzle: There is a light switch you must turn on.", font, BLACK, screen, screen_width // 2, screen_height - 100)
    draw_text("Type 'on' to turn the light on!", font, BLACK, screen, screen_width // 2, screen_height - 50)
    draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 20)
    pygame.display.update()

    answer = ''
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if answer.lower() == 'on':
                        return True
                    else:
                        answer = ''
                elif event.key == pygame.K_BACKSPACE:
                    answer = answer[:-1]
                elif event.key == pygame.K_g:  # Give up
                    return False
                else:
                    answer += event.unicode

        draw_background()
        draw_text("Puzzle: There is a light switch you must turn on.", font, BLACK, screen, screen_width // 2, screen_height - 100)
        draw_text("Your answer: " + answer, font, BLACK, screen, screen_width // 2, screen_height - 50)
        draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 20)
        pygame.display.update()

# Final puzzle: Elevator with code
def final_puzzle():
    draw_background()
    screen.blit(elevator_img, (50, 500))
    draw_text("To escape, type 'code' to open the elevator.", font, BLACK, screen, screen_width // 2, screen_height - 100)
    draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 50)
    pygame.display.update()

    answer = ''
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if answer.lower() == 'code':
                        draw_text("The elevator opens, and you escape! Congratulations!", big_font, GREEN, screen, screen_width // 2, screen_height // 2)
                        pygame.display.update()
                        pygame.time.delay(2000)
                        return True
                    else:
                        answer = ''
                elif event.key == pygame.K_BACKSPACE:
                    answer = answer[:-1]
                elif event.key == pygame.K_g:  # Give up
                    return False
                else:
                    answer += event.unicode

        draw_background()
        screen.blit(elevator_img, (50, 500))
        draw_text("To escape, type 'code' to open the elevator.", font, BLACK, screen, screen_width // 2, screen_height - 100)
        draw_text("Your answer: " + answer, font, BLACK, screen, screen_width // 2, screen_height - 50)
        draw_text("Press 'G' to give up.", font, BLACK, screen, screen_width // 2, screen_height - 20)
        pygame.display.update()

# Introduction screen
def show_intro():
    intro_text = "Welcome to the Unconventional Escape Room!"
    while True:
        screen.fill(WHITE)
        draw_text(intro_text, big_font, BLACK, screen, screen_width // 2, screen_height // 2 - 100)
        draw_text("Press ENTER to Start", font, BLACK, screen, screen_width // 2, screen_height // 2 + 100)
        pygame.display.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    return

# Ending screen
def show_ending():
    ending_text = "Game Over. Thanks for playing!"
    while True:
        screen.fill(WHITE)
        draw_text(ending_text, big_font, BLACK, screen, screen_width // 2, screen_height // 2 - 100)
        draw_text("Press ESC to Exit", font, BLACK, screen, screen_width // 2, screen_height // 2 + 100)
        pygame.display.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    quit()

# Main game loop
def game_loop():
    show_intro()  # Show intro screen
    intro_text = "Solve the puzzles and escape the room!"
    while True:
        screen.fill(WHITE)
        draw_text(intro_text, big_font, BLACK, screen, screen_width // 2, screen_height // 2 - 100)
        display_timer()
        pygame.display.update()

        # Timer check
        elapsed_time = time.time() - start_time
        if elapsed_time >= time_limit:
            draw_text("Time's up! You failed to escape in time.", big_font, RED, screen, screen_width // 2, screen_height // 2 + 50)
            pygame.display.update()
            pygame.time.delay(3000)
            break
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if chair_puzzle():  # Chair puzzle
                        if number_guessing_game():  # Number Guessing Game
                            if clock_puzzle():  # Clock puzzle
                                if click_dot_game():  # Click Dot Game
                                    if light_switch_puzzle():  # Light Switch puzzle
                                        if final_puzzle():  # Final puzzle
                                            elapsed_time = time.time() - start_time
                                            draw_text(f"Congratulations! You escaped in {elapsed_time // 60} minutes and {elapsed_time % 60} seconds.", big_font, GREEN, screen, screen_width // 1.5, screen_height // 1.5)
                                            pygame.display.update()
                                            pygame.time.delay(5000)
                                            return
        pygame.time.delay(100)

if __name__ == "__main__":
    game_loop()
    pygame.quit()
