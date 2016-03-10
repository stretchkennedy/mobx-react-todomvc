import React from 'react';
import {observer} from 'mobx-react';

const ESCAPE_KEY = 27;
const ENTER_KEY = 13;

@observer
export default class TodoItem extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.state = {editText: props.todo.title};
  }

  render() {
    const {viewModel, todo} = this.props;
    return (
      <li className={[
        todo.completed ? "completed": "",
        todo === viewModel.todoBeingEdited ? "editing" : ""
      ].join(" ")}>
        <div className="view">
          <input
            className="toggle"
            type="checkbox"
            checked={todo.completed}
            onChange={this.handleToggle}
          />
          <label onDoubleClick={this.handleEdit}>
            {todo.title}
            {todo.saving ? <span style={{color: "grey"}}>(saving...)</span> : ""}
            {todo.destroying ? <span style={{color: "grey"}}>(destroying...)</span> : ""}
            {todo.needsSaveRetry ? <span onClick={this.handleSaveRetry} style={{color: "red", marginLeft: "20px"}}>
                                     (retry save)
                                   </span> : ""}
            {todo.needsDestroyRetry ? <span onClick={this.handleDestroyRetry} style={{color: "red", marginLeft: "20px"}}>
                                        (retry delete)
                                      </span> : ""}
          </label>
          <button className="destroy" onClick={this.handleDestroy} />
        </div>
        <input
          ref="editField"
          className="edit"
          value={this.state.editText}
          onBlur={this.handleSubmit}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
        />
      </li>
    );
  }

  handleSaveRetry = () => {
    this.props.todo.save()
  }

  handleDestroyRetry = () => {
    this.props.todo.destroy()
  }

  handleSubmit = (event) => {
    const val = this.state.editText.trim();
    if (val) {
      this.props.todo.setTitle(val);
      this.setState({editText: val});
    } else {
      this.handleDestroy();
    }
    this.props.viewModel.todoBeingEdited = null;
  };

  handleDestroy = () => {
    this.props.todo.destroy();
    this.props.viewModel.todoBeingEdited = null;
  };

  handleEdit = () => {
    const todo = this.props.todo;
    this.props.viewModel.todoBeingEdited = todo;
    this.setState({editText: todo.title});
  };

  handleKeyDown = (event) => {
    if (event.which === ESCAPE_KEY) {
      this.setState({editText: this.props.todo.title});
      this.props.viewModel.todoBeingEdited = null;
    } else if (event.which === ENTER_KEY) {
      this.handleSubmit(event);
    }
  };

  handleChange = (event) => {
    this.setState({editText: event.target.value});
  };

  handleToggle = () => {
    this.props.todo.toggle();
  };
}

TodoItem.propTypes = {
  todo: React.PropTypes.object.isRequired,
  viewModel: React.PropTypes.object.isRequired
};
